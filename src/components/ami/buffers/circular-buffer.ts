
const MaxBufferSize = 65536 * 2

export class CircularBuffer  {

    private buffer = Buffer.alloc(MaxBufferSize)
    private start = 0;
    private end = 0;
    private bytes = 0;
    private looped = false;

    report() {
        return {
            start: this.start,
            end: this.end,
            bytes: this.bytes,
            bufferLength: this.buffer.length,
            looped: this.looped
        }
    }

    append(data: Buffer) : void {

        if ( data.length > this.buffer.length ){
            throw new Error(`Trying to write more bytes that circular buffer capacity`)
        }

        if  ( data.length <= this.buffer.length - this.end ){
            data.copy(this.buffer, this.end)
            this.end = this.end + data.length
            if ( this.looped && (this.start < this.end) ){
                this.start = this.end;
            }
        }
        else {

            let m = this.buffer.length - this.end;
            let t = data.length - m;
            data.copy(this.buffer, this.end, 0, m)
            data.copy(this.buffer, 0, m)
            this.end = t;
            if ( this.looped ){
                this.start = this.end;
            }
            else if ( t > this.start ){
                this.start = t;
            }

            this.looped = true;
        }

        this.measure();
    }

    measure() {
        if ( (this.end > this.start) && !this.looped ){
            this.bytes = this.end - this.start;
        }
        else if ( (this.end < this.start) && this.looped ){
            this.bytes = this.buffer.length - this.start + this.end;
        }
        else if ( this.end == this.start && this.looped ){
            this.bytes = this.buffer.length;
        }
        else if ( this.end == this.start && !this.looped ) {
            this.bytes = 0;
        }
        else if ( (this.end > this.start) && this.looped ){
            throw new Error(`Impossible state 1: ${this.end}, ${this.start}`)
        }
        else if ( (this.end < this.start) && !this.looped ){
            throw new Error(`Impossible state 2: ${this.end}, ${this.start}`)
        }
    }

    length() : number {
        return this.bytes;
    }

    capacity() : number {
        return this.buffer.length;
    }

    compact() : void {
        this.buffer.copy(this.buffer, 0, this.start, this.end);
        this.end = this.end - this.start;
        this.start = 0;
    }

    indexOf(pattern: Buffer) : number {
        let pos = this.buffer.indexOf(pattern);
        if ( pos > this.start ){
            pos = pos - this.start;
        }
        if ( pos > this.end || pos == -1 ){
            return -1;
        }
        return pos;
    }

    read(target: Buffer, count: number) {

        if (count > this.length()) {
            throw new Error(`Tried to read more than contained in the circular buffer: requested=${count}, bytes=${this.bytes}`)
        }

        if  ( !this.looped ) {

            let chunk = this.buffer.slice(this.start, this.start + count);
            this.start = this.start + count;
            chunk.copy(target, 0, 0);

        } else {

            let firstChunk = this.buffer.slice(this.start);
            if ( firstChunk.length > 0 ){
                firstChunk.copy(target, 0, 0);
            }
            let r = count - firstChunk.length;
            if  ( r > 0 ) {
                let secondChunk = this.buffer.slice(0, r);
                secondChunk.copy(target, firstChunk.length, 0)
            }
            this.start = r;
            this.looped = false;
        }

        this.measure()
    }

    reset() {
        this.start = 0
        this.end = 0
    }

}
