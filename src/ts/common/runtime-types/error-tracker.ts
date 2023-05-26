function describeType(x: unknown): string {
    if (typeof x === 'object') {
        if (x === undefined) return 'undefined';
        if (x === null) return 'null';
        if (Array.isArray(x)) return '[' + x.map(describeType).join(', ') + ']';
        return [
            '{',
            Object.entries(x)
                .map(([k, v]) => `"${k}": ${describeType(v)}`)
                .join(', '),
            '}',
        ].join('');
    }
    return typeof x;
}

export class ValidationErrorTracker {
    public expected = new Map<string, string[]>();
    public got = new Map<string, unknown>();

    public writer(path: string, value: unknown) {
        this.got.set(path, value);
        return new ValidationErrorWriter(this, path);
    }

    public write(path: string, expected: string[]) {
        const existing = this.expected.get(path) ?? [];
        existing.push(...expected);
        this.expected.set(path, existing);
    }

    public error() {
        const err = Array.from(this.expected).map(([path, expected]) => {
            const got = describeType(this.got.get(path));
            return `${path}: expected: [${expected.join(', ')}] got ${got}`;
        });
        return err.join('\n');
    }
}

export class ValidationErrorWriter {
    private tracker: ValidationErrorTracker;
    private localization: string;

    public constructor(tracker: ValidationErrorTracker, localization: string) {
        this.tracker = tracker;
        this.localization = localization;
    }

    public expected(...names: string[]) {
        this.tracker.write(this.localization, names);
    }

    public enter(name: string, value: unknown) {
        return this.tracker.writer(this.localization + '.' + name, value);
    }
}

export class RuntimeTypeError extends Error {}

export class ValidationError extends RuntimeTypeError {
    constructor(expected: string[], got: unknown, path?: string) {
        const msg = `expected: [${expected.join(',')}]\ngot: ${describeType(got)}`;
        if (path && path.length > 0) super(`for ${path} ${msg}`);
        else super(msg);
    }
}
