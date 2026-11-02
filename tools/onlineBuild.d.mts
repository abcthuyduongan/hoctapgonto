import type {Plugin} from 'vite';
export function retirementWorkerSource(buildId:string):string;
export function onlineBuildPlugin(identity:{sourceId:string;version:string;commit:string|null;displayMode:string;questionProtocolVersion:number}):Plugin;
