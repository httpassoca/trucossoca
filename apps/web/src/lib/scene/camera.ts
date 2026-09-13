/** Olhar em primeira pessoa: yaw/pitch alvo (mouse) e suavizado (frame). */
export const look = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
export const CAM_DIST = 1.45, CAM_H = 1.4, LOOK_H = 0.7;
export const BASE_PITCH = -Math.atan2(CAM_H - LOOK_H, CAM_DIST);
export function resetLook() { look.tyaw = 0; look.tpitch = 0; }
