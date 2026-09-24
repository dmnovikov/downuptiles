export interface Screen { id: string; name: string; assets: string[] }
export interface Workspace { version: 1; initialized: true; activeScreenId: string; screens: Screen[] }
