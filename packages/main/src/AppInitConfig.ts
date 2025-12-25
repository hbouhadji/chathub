export type AppInitConfig = {
  preload: {
    path: string;
  };
  viewPreload: {
    path: string;
  };

  renderer:
    | {
        path: string;
      }
    | URL;
};
