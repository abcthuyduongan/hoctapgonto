import { createContext, useContext } from 'react';
import type { GuideMood } from './renderer/types';

/** Presentation events never enter the learning SDK or storage. */
export const GameSceneContext = createContext<{ setMood: (mood: GuideMood) => void }>({ setMood() {} });
export const useGameScene = () => useContext(GameSceneContext);
