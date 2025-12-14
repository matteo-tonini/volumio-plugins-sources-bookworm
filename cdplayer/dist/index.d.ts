interface CDTrack {
    album: string;
    artist: string;
    title: string;
    name: string;
    trackType: string;
    type: string;
    service: string;
    uri: string;
    duration: number;
}
declare class CDPlayer {
    #private;
    _items: CDTrack[] | null;
    _trayWatcher: any | null;
    _discIdentifier: number;
    constructor(context: any);
    log(msg: string): void;
    error(err: string): void;
    onStart(): any;
}
export = CDPlayer;
//# sourceMappingURL=index.d.ts.map