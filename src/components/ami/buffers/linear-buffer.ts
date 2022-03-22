
export class LinearBuffer {

    private readonly buffer: Buffer
    private start = 0;
    private end = 0;
    private bytes = 0;

    constructor(maxBufferSize: number) {
        this.buffer = Buffer.alloc(maxBufferSize)
    }

    append(data: Buffer) : number {

        if ( data.length > this.buffer.length ){
            return -1
        }

        data.copy(this.buffer, this.end);
        this.end = this.end + data.length;
        return this.length()
    }

    length() : number {
        return this.end - this.start;
    }

    compact() : void {
        this.buffer.copy(this.buffer, 0, this.start, this.end);
        this.end = this.end - this.start;
        this.start = 0;
    }

    indexOf(pattern: Buffer) : number {

        if ( this.end < this.start ) {
            return -1;
        }

        if ( this.end - this.start < pattern.length ) {
            return -1;
        }

        // const pos = this.buffer.subarray(this.start, this.end).indexOf(pattern)
        const pos = this.buffer.indexOf(pattern, this.start);

        if ( pos == -1 ){
            // pattern not found in raw buffer
            return -1;
        }

        if ( pos > this.end - pattern.length  ){
            // pattern found in read bytes
            return -1;
        }

        return pos - this.start;
    }

    read(count: number): Buffer {

        if (count > this.length()) {
            return null
        }

        let chunk = this.buffer.slice(this.start, this.start + count)
        this.start = this.start + count
        return chunk;
    }

    reset() {
        this.start = 0
        this.end = 0
    }

    toString() : string {
        return JSON.stringify({
            buffer: this.buffer.slice(this.start, this.end).toString("utf8"),
            start: this.start,
            end: this.end
        })
    }

}
