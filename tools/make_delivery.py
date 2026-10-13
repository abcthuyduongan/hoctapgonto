from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib, json
root=Path(__file__).resolve().parents[1]
out=Path('/mnt/data/BAO_AN_LEARNING_V3_6_BAN_GIAO.zip')
paths=[]
for file in root.rglob('*'):
    if not file.is_file():continue
    rel=file.relative_to(root)
    if any(x in rel.parts for x in ['node_modules','.git','__pycache__']):continue
    # Trim archived previews, logs and legacy screenshots; retain current evidence and all app code.
    if rel.parts[0]=='preview' and file.suffix in ['.png','.jpg','.json','.log']:continue
    if rel.parts[0]=='docs' and not (str(rel).startswith('docs/V36_qa/') or file.name.endswith('.md')):continue
    if file.name.endswith('.log') or file.name in ['test-before.log','test-applicable.log','qa32.log','qa-output.log']:continue
    if file.name in ['BAO_AN_3D_OFFLINE.html','reference-v31.html']:continue
    paths.append(file)
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=7) as z:
    for f in paths:z.write(f,arcname=str(Path('BAO_AN_LEARNING_V3_6')/f.relative_to(root)))
with ZipFile(out) as z:
    corrupt=z.testzip()
    assert corrupt is None,corrupt
    names=z.namelist()
    assert any(x.endswith('BAO_AN_LEARNING_V3_6_PLAYABLE.html') for x in names)
    assert any(x.endswith('src/world3d/engine.ts') for x in names)
    assert any(x.endswith('public/models/fox-guide-mobile.glb') for x in names)
print('ARCHIVE',out,'files',len(paths),'size_MB',round(out.stat().st_size/1024**2,2),'sha256',hashlib.sha256(out.read_bytes()).hexdigest())
