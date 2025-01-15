export default class AsyncMutex {
    private locked = false;
    private queue: (() => void)[] = [];

    async lock(): Promise<void> {
        return new Promise<void>(resolve => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    unlock(): void {
        if(this.queue.length > 0) {
            const next = this.queue.shift();
            next?.();
        } else {
            this.locked = false;
        }
    }
}