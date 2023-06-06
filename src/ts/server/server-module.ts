import { Game } from './game';
import Server from './server';

export abstract class ServerModule {
    public name: string = Object.getPrototypeOf(this).constructor.name;
    public abstract load(server: Server): void;
}
