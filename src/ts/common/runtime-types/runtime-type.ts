import { RuntimeTypeError, ValidationErrorTracker, ValidationErrorWriter } from './error-tracker';

type Is<T> = (x: unknown) => x is T;
type Validate<T> = (x: unknown, tracker: ValidationErrorWriter) => x is T;
type Cast<T> = (x: unknown) => T;
type Assert<T> = (x: unknown) => asserts x is T;

export interface RuntimeType<T, Optional extends boolean = false> {
    name: string;
    is: Is<T>;
    validate: Validate<T>;
    cast: Cast<T>;
    assert: Assert<T>;
}

class RuntimeTypeDef<T, Optional extends boolean = false> implements RuntimeType<T, Optional> {
    public name: string;
    public is: Is<T>;
    public validate: Validate<T>;

    constructor(name: string, is: Is<T>, validate: Validate<T>) {
        this.name = name;
        this.is = is;
        this.validate = validate;
    }

    public cast(x: unknown): T {
        const tracker = new ValidationErrorTracker();
        if (this.validate(x, tracker.writer('', x))) return x;
        throw new RuntimeTypeError(tracker.error());
    }

    public assert(x: unknown): asserts x is T {
        const tracker = new ValidationErrorTracker();
        if (this.validate(x, tracker.writer('', x))) return;
        throw new RuntimeTypeError(tracker.error());
    }
}

export class RuntimePrimitve<T, Optional extends boolean = false> extends RuntimeTypeDef<T, Optional> {
    public constructor(name: string, is: Is<T>) {
        super(name, is, (x: unknown, tracker: ValidationErrorWriter): x is T => {
            if (this.is(x)) return true;
            this.complain(tracker);
            return false;
        });
    }

    private complain(tracker: ValidationErrorWriter) {
        tracker.expected(this.name);
    }
}

export class RuntimeObject<T extends {}> extends RuntimeTypeDef<T> {
    public constructor(name: string, validate: Validate<T>) {
        super(
            name,
            (x: unknown): x is T => {
                const tracker = new ValidationErrorTracker();
                return this.validate(x, tracker.writer('', x));
            },
            validate
        );
    }
}

export class CircularType<T> extends RuntimeTypeDef<T> {
    public constructor(name: string) {
        super(name, undefined, undefined);
    }

    public morph(t: RuntimeTypeDef<T>) {
        this.is = t.is;
        this.validate = t.validate;
    }
}

export type CompileType<T extends RuntimeType<any>> = T extends RuntimeType<infer X> ? X : never;
