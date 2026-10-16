import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('osirisDesktop', { isDesktop: true });
