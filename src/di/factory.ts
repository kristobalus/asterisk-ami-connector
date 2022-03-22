

export interface Factory<T> {
    create(tag?: string): T;
}