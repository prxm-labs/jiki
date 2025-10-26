export type EventListener = (...args: any[]) => void;

interface EventData {
  events: Map<string, EventListener[]>;
  maxListeners: number;
}

const store = new WeakMap<object, EventData>();

function getData(self: object): EventData {
  let data = store.get(self);
  if (!data) {
    data = { events: new Map(), maxListeners: 10 };
    store.set(self, data);
  }
  return data;
}

export class EventEmitter {
  on(event: string, listener: EventListener): this {
    return this.addListener(event, listener);
  }

  addListener(event: string, listener: EventListener): this {
    const { events } = getData(this);
    if (!events.has(event)) events.set(event, []);
    events.get(event)!.push(listener);
    return this;
  }

  once(event: string, listener: EventListener): this {
    const wrapper = (...args: unknown[]) => {
      this.removeListener(event, wrapper);
      listener.apply(this, args);
    };
    return this.addListener(event, wrapper);
  }

  off(event: string, listener: EventListener): this {
    return this.removeListener(event, listener);
  }

  removeListener(event: string, listener: EventListener): this {
    const listeners = getData(this).events.get(event);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    }
    return this;
  }

  removeAllListeners(event?: string): this {
    const { events } = getData(this);
    if (event) events.delete(event);
    else events.clear();
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const listeners = getData(this).events.get(event);
    if (!listeners || listeners.length === 0) {
      if (event === "error") {
        const err = args[0];
        throw err instanceof Error ? err : new Error("Unhandled error event");
      }
      return false;
    }
    for (const listener of [...listeners]) {
      try {
        listener.apply(this, args);
      } catch (err) {
        console.error("Event listener error:", err);
      }
    }
    return true;
  }

  listeners(event: string): EventListener[] {
    return [...(getData(this).events.get(event) || [])];
  }
  rawListeners(event: string): EventListener[] {
    return this.listeners(event);
  }
  listenerCount(event: string): number {
    return getData(this).events.get(event)?.length || 0;
  }
  eventNames(): string[] {
    return [...getData(this).events.keys()];
  }

  setMaxListeners(n: number): this {
    getData(this).maxListeners = n;
    return this;
  }
  getMaxListeners(): number {
    return getData(this).maxListeners;
  }

  prependListener(event: string, listener: EventListener): this {
    const { events } = getData(this);
    if (!events.has(event)) events.set(event, []);
    events.get(event)!.unshift(listener);
    return this;
  }

  prependOnceListener(event: string, listener: EventListener): this {
    const wrapper = (...args: unknown[]) => {
      this.removeListener(event, wrapper);
      listener.apply(this, args);
    };
    return this.prependListener(event, wrapper);
  }

  static listenerCount(emitter: EventEmitter, event: string): number {
    return emitter.listenerCount(event);
  }

  static once(emitter: EventEmitter, event: string): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const onEvent: EventListener = (...args) => {
        emitter.removeListener("error", onError);
        resolve(args);
      };
      const onError: EventListener = (...args) => {
        emitter.removeListener(event, onEvent);
        reject(args[0]);
      };
      emitter.once(event, onEvent);
      if (event !== "error") {
        emitter.once("error", onError);
      }
    });
  }
}

const events = EventEmitter as typeof EventEmitter & {
  EventEmitter: typeof EventEmitter;
  once: (emitter: EventEmitter, event: string) => Promise<unknown[]>;
  on: (emitter: EventEmitter, event: string) => AsyncIterable<unknown[]>;
  getEventListeners: (emitter: EventEmitter, event: string) => EventListener[];
  listenerCount: (emitter: EventEmitter, event: string) => number;
};

events.EventEmitter = EventEmitter;
events.once = async (
  emitter: EventEmitter,
  event: string,
): Promise<unknown[]> => {
  return new Promise((resolve, reject) => {
    const onEvent: EventListener = (...args) => {
      emitter.removeListener("error", onError);
      resolve(args);
    };
    const onError: EventListener = (...args) => {
      emitter.removeListener(event, onEvent);
      reject(args[0]);
    };
    emitter.once(event, onEvent);
    emitter.once("error", onError);
  });
};
events.on = (emitter: EventEmitter, event: string) => {
  const iterator = {
    async next() {
      return new Promise<{ value: unknown[]; done: boolean }>(resolve => {
        emitter.once(event, (...args) => resolve({ value: args, done: false }));
      });
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return iterator as AsyncIterable<unknown[]>;
};
events.getEventListeners = (emitter, event) => emitter.listeners(event);
events.listenerCount = (emitter, event) => emitter.listenerCount(event);

export default events;
