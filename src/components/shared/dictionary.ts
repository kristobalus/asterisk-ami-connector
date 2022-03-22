

export interface Dictionary<T> {
    [Key: string]: T;
}

export function buildMapFromDictionary(dictionary: Dictionary<any>) : Map<string, any> {
    const map = new Map()
    if ( dictionary ) {
        for(let [key, value] of Object.entries(dictionary)) {
            map.set(key, value)
        }
    }
    return map
}