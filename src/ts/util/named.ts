const NAME = Symbol('NAME');

export class Named {
    private [NAME]: string;

    constructor(description: string) {
        this[NAME] = description;
    }

    toString() {
        return String(this[NAME]);
    }

    public static readonly NAME = NAME;
}
