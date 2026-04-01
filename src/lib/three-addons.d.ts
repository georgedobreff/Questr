declare module 'three/examples/jsm/utils/SkeletonUtils' {
  import { Object3D, AnimationClip, Skeleton } from 'three';
  export function clone(object: Object3D): Object3D;
  export function retarget(target: Object3D | Skeleton, source: Object3D | Skeleton, options: object): void;
  export function retargetClip(target: Object3D, source: Object3D, clip: AnimationClip, options: object): AnimationClip;
}
