import { Box3, Group, PerspectiveCamera, Vector3 } from 'three';
import type { GuideViewport } from '../renderer/types';

/** Put the existing rig in the reserved HTML guide window without another canvas. */
export function fitGuideViewport(guide: Group, bounds: Box3, camera: PerspectiveCamera,
  viewport: GuideViewport, canvasWidth: number, canvasHeight: number) {
  if (![viewport.x, viewport.y, viewport.width, viewport.height, canvasWidth, canvasHeight].every(Number.isFinite)
    || viewport.width <= 0 || viewport.height <= 0 || canvasWidth <= 0 || canvasHeight <= 0 || bounds.isEmpty()) {
    guide.visible = false;
    return false;
  }
  const depth = 8;
  const heightAtDepth = 2 * depth * Math.tan(camera.fov * Math.PI / 360);
  const widthAtDepth = heightAtDepth * camera.aspect;
  const size = bounds.getSize(new Vector3());
  let scale = Math.min(viewport.width / canvasWidth * widthAtDepth / Math.max(.01, size.x),
    viewport.height / canvasHeight * heightAtDepth / Math.max(.01, size.y)) * .84;
  const cameraCenter = new Vector3(
    ((viewport.x + viewport.width / 2) / canvasWidth - .5) * widthAtDepth,
    (.5 - (viewport.y + viewport.height / 2) / canvasHeight) * heightAtDepth,
    -depth,
  );
  guide.quaternion.copy(camera.quaternion);
  const localCenter = bounds.getCenter(new Vector3());
  const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
    [bounds.min.z, bounds.max.z].map(z => new Vector3(x, y, z))));
  // A rig has depth: off-axis perspective can crop a plane-fitted fox near
  // the screen edge. Fit its entire projected volume, including that parallax.
  for (let attempt = 0; attempt < 12; attempt++) {
    guide.scale.setScalar(Math.max(.0001, scale));
    guide.position.copy(cameraCenter).applyQuaternion(camera.quaternion).add(camera.position)
      .sub(localCenter.clone().multiplyScalar(guide.scale.x).applyQuaternion(guide.quaternion));
    guide.updateMatrixWorld(true);
    const pixels = corners.map(corner => {
      const point = corner.clone().applyMatrix4(guide.matrixWorld).project(camera);
      return { x: (point.x + 1) * canvasWidth / 2, y: (1 - point.y) * canvasHeight / 2 };
    });
    const left = Math.min(...pixels.map(point => point.x)), right = Math.max(...pixels.map(point => point.x));
    const top = Math.min(...pixels.map(point => point.y)), bottom = Math.max(...pixels.map(point => point.y));
    const dx = (left + right) / 2 - (viewport.x + viewport.width / 2);
    const dy = (top + bottom) / 2 - (viewport.y + viewport.height / 2);
    const shrink = Math.min(1, viewport.width * .86 / Math.max(.01, right - left),
      viewport.height * .86 / Math.max(.01, bottom - top));
    if (Math.abs(dx) < .25 && Math.abs(dy) < .25 && shrink >= .999) break;
    cameraCenter.x -= dx / canvasWidth * widthAtDepth;
    cameraCenter.y += dy / canvasHeight * heightAtDepth;
    scale *= shrink;
  }
  guide.visible = true;
  return true;
}
