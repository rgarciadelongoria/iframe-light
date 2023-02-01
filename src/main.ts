export interface IframeChild {
    elementRef: HTMLIFrameElement;
    name: string;
}

export interface IframeFather {
    uri: string;
    name: string;
}

export class IframeLight {
    private static instance: IframeLight;
    private _fathers: IframeFather[] = [];
    private _children: IframeChild[] = [];

    public get fathers() {
        return this._fathers;
    }
    public set fathers(fathers: IframeFather[]) {
        this._fathers = fathers;
    }
    public get children() {
        return this._children;
    }
    public set children(children: IframeChild[]) {
        this._children = children;
    }

    constructor() {
        this.initEvents();
        console.warn('MicrofrontLight Ready!');
    }

    private initEvents() {
        window.onmessage = (event: any) => {
            if (this.hasCorrectOrigin(event)) {
                console.log('onmessage', event);
                alert(event.data);
            }
        }
    }

    private hasCorrectOrigin(event: any): boolean {
        return (
            !!(this.findFatherByOrigin(event.origin)) ||
            !!(this.findChildByOrigin(event.origin))
        );
    }

    private findFatherByOrigin(origin: string): IframeFather | undefined {
        return this.fathers.find((father, index) => father?.uri === origin);
    }

    private findFatherByName(name: string): IframeFather | undefined {
        return this.fathers.find((father, index) => father?.name === name);
    }

    private findChildByOrigin(origin: string): IframeChild | undefined {
        return this.children.find((child, index) => (child as any).elementRef?.nativeElement?.getAttribute('src') === origin);
    }

    private findChildByName(name: string): IframeChild | undefined {
        return this.children.find((child, index) => child?.name === name);
    }

    public static init() {
        if (!IframeLight.instance) {
            IframeLight.instance = new IframeLight();
        }
        return IframeLight.instance;
    }

    public addFather(uri: string, name: string): void {
        const father: IframeFather = {
            uri,
            name
        }
        this.fathers.push(father);
    }

    public addChild(iframe: HTMLIFrameElement, name: string) {
        const child: IframeChild = {
            elementRef: iframe,
            name
        }
        this.children.push(child);
    }

    public messageToFatherByName(name: string, message: any) {
        const father = this.findFatherByName(name);
        if (father) {
            parent.postMessage(message, father.uri);
        }
    }   

    public messageToChildByName(name: string, message: any) {
        const child = this.findChildByName(name);
        if (child) {
            const src = (child as any)?.elementRef?.nativeElement?.getAttribute('src');
            (child as any).elementRef.nativeElement?.contentWindow?.postMessage(message, src);
        }
    }      
}