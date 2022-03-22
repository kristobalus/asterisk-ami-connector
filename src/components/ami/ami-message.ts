
const LineSeparatorChars = `\r\n`
const KeyValueSplitChars = `: `


/**
 * Fields with the same key may be repeated within an AMI message
 */
export class AmiMessage {

    public fields: Map<string, string[]> = new Map()

    public appendField(key: string, value: string): void {

        if (!this.fields.has(key)){
            this.fields.set(key, [])
        }

        this.fields.get(key).push(value)
    }

    public get(key: string) : string[] {
        return this.fields.get(key)
    }

}
