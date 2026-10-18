type AssetCallbacks<T>={
  load:(id:string, signal:AbortSignal)=>Promise<T>;
  attach:(id:string, asset:T)=>void;
  release:(asset:T)=>void;
  failed:(id:string, error:unknown)=>void;
};
/** One owned detail asset, one in-flight decoder, and only the latest requested destination. */
export class SelectedAsset<T> {
  private revision = 0;
  private disposed = false;
  private current?: { id: string; asset: T };
  private requested:string|null|undefined;
  private controller?: AbortController;
  private pending: Promise<void> = Promise.resolve();
  private callbacks:AssetCallbacks<T>;
  constructor(callbacks:AssetCallbacks<T>) {this.callbacks=callbacks;}
  get activeId() { return this.current?.id; }
  select(id:string|null) {
    if(this.disposed || id===this.requested)return this.pending;
    this.requested=id;
    const revision=++this.revision;
    this.controller?.abort();
    if(this.current){this.callbacks.release(this.current.asset);this.current=undefined;}
    const controller=new AbortController();this.controller=controller;
    // A parser cannot necessarily be interrupted. Wait for it to finish/release
    // before allocating the next one; intermediate rapid selections never start.
    this.pending=this.pending.then(async()=>{
      if(this.disposed||revision!==this.revision||id===null)return;
      try{
        const asset=await this.callbacks.load(id,controller.signal);
        if(this.disposed||revision!==this.revision||controller.signal.aborted){this.callbacks.release(asset);return;}
        try {this.callbacks.attach(id,asset);this.current={id,asset};}
        catch(error){this.callbacks.release(asset);throw error;}
      }catch(error){if(!this.disposed&&revision===this.revision&&!controller.signal.aborted){this.requested=undefined;this.callbacks.failed(id,error);}}
    });
    return this.pending;
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;++this.revision;this.controller?.abort();
    if(this.current){this.callbacks.release(this.current.asset);this.current=undefined;}
  }
}
