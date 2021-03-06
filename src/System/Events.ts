/**
 * This module is responsible for managing type-safe event observer pattern.
 *
 * You may create an Event class that will function as single event with some data,
 * eg:
 *
 * class ECylinderSelected {
 *   public cylinder: ICylinder;
 * }
 *
 * And then you can trigger this event at any time, passing proper payload:
 *
 * Events.trigger(ECylinderSelected, { cylinder: someCylinder });
 *
 * And you can also listen to this event:
 *
 * Events.listen(ECylinderSelected, payload => console.log(payload.cylinder));
 *
 *
 * Events.on(ECylinderSelected, payload => console.log(payload.cylinder));
 *
 * Everything 100% typechecked.
 */
import 'reflect-metadata';
import { remove } from 'lodash';
import { Injectable } from './Injectable';

// any type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IUnknown = any;

// holds an event class, eg. ECylinderSelected is that
export type IEventType<T> = new () => T;

// holds data of an event class
export type IEventData<T> = {
  // map every property from event class to this interface
  [P in keyof T]: T[P];
};

// holds handler information, used internally
export interface IEventHandler<T> {
  id: number;
  callback: IEventCallback<T>;
}

// holds callback information, used internally
type IEventCallback<T> = (data: T) => void | Promise<void>;

// holds id of event
export interface IEventId {
  readonly __id: number;
  readonly __type: IEventType<IUnknown>;
}

@Injectable()
/**
 * This class is responsible for managing events.
 */
export class Events {
  // holds last assigned id
  private fLastId = 0;

  // holds map of handlers, with key being event class and value is
  // an array of callback handlers
  private fHandlers: Map<IEventType<IUnknown>, IEventHandler<IUnknown>[]> = new Map();

  /**
   * Registers listener for event of particular type. Everytime event is called, the listener
   * will be executed.
   *
   * @param type type of event, simple class
   * @param callback callback fired when event is triggered
   * @returns unique ID for event listener, can be used to disable this listener
   */
  public on<T>(type: IEventType<T>, callback: IEventCallback<T>): IEventId {
    // get all handlers for particular event type and create empty array there is no events for this yet
    let handlersOfType: IEventHandler<T>[] | undefined = this.fHandlers.get(type);
    if (!handlersOfType) {
      handlersOfType = [];
      this.fHandlers.set(type, handlersOfType);
    }

    // generate unique id
    const genId: number = this.fLastId++;

    // prepare handler
    const handler: IEventHandler<T> = {
      callback,
      id: genId,
    };

    // push handler and return event metadata
    handlersOfType.push(handler);
    return { __id: genId, __type: type };
  }

  /**
   * Waits for single event execution and removes the listener immediately after.
   *
   * @example
   * this.gCart.addItem(product);
   * await this.gEvents.waitFor(CartUpdatedEvent);
   * console.log('here cart updated event is already called');
   *
   * @param type type of event to wait for
   * @param timeout timeout param in ms - if event is not thrown until this time, it'll reject. passing null disables the timeout
   * @returns promise with event data that resolves when event is finally called
   */
  public waitFor<T>(type: IEventType<T>, timeout: number | null = 10 * 1000): Promise<T> {
    return new Promise((resolve, reject) => {
      // define setTimeout variable
      let waitTimeout: any;

      // listen on event type and save eventId
      const eventId = this.on(type, (data) => {
        this.off(eventId);
        resolve(data);
        // if timeout was specified, cancel it
        if (waitTimeout) {
          clearTimeout(waitTimeout);
        }
      });

      // if user passed timeout, set it properly
      if (timeout !== null) {
        waitTimeout = setTimeout(() => {
          // clear the event listener and reject promise
          this.off(eventId);
          reject(new Error(`Waiting for event timeout - ${type.name}`));
        }, timeout);
      }
    });
  }

  /**
   * Removes listener from particular event.
   * @param eventId eventId returned from .on() method.
   * @returns true if event was removed, false if it wasnt registered
   */
  public off<T>(eventId: IEventId): number {
    const type: IEventType<T> = eventId.__type;
    const handlersOfType: IEventHandler<T>[] | undefined = this.fHandlers.get(type);

    if (!handlersOfType) {
      throw new Error('Trying to unbind event that was not bound.');
    }

    const removed: IEventHandler<IUnknown>[] = remove(handlersOfType, (h) => h.id === eventId.__id);

    if (removed.length === 0) {
      throw new Error('Trying to unbind event that was not bound.');
    }

    return removed.length;
  }

  /**
   * Triggers event, calling all listener callbacks. Will return Promise of number,
   * that is resolved when all asynchronous listeners are called.
   * @param type type of trigger, simple class
   * @param data data which will be passed to listeners, based on event class
   * @return number of listeners that were notified
   */
  public async trigger<T>(type: IEventType<T>, data?: IEventData<T>): Promise<number> {
    const handlersOfType: IEventHandler<T>[] | undefined = this.fHandlers.get(type);
    if (!handlersOfType) {
      return 0;
    }

    // copy the array as handler might remove the listener itself, modifying original array during iteration
    const toProcessHandlers = [...handlersOfType];

    const promises: Promise<void>[] = toProcessHandlers.map((handler) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const instance: T = this.objectToClass(type, data!);
      const result: void | Promise<void> = handler.callback(instance);
      if (result instanceof Promise) {
        return result;
      } else {
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
    return toProcessHandlers.length;
  }

  /**
   * Converts plain object to it's class equivalent.
   * It's NOT class-transformer, it performs basic key assigment.
   *
   * @param ClassConstructor event constructor
   * @param data event data to be mapped to constructor
   * @return class type of event
   */
  private objectToClass<T>(ClassConstructor: IEventType<T>, data: IEventData<T>): T {
    const instance: T = new ClassConstructor();

    // rewrite data keys to instance
    if (data) {
      Object.keys(data).forEach((key) => {
        // copy all properties to convert it to class instance

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const rawInstance: any = instance;
        const rawData: any = data;
        rawInstance[key] = rawData[key];
        /* eslint-enable @typescript-eslint/no-explicit-any */
      });
    }

    return instance;
  }
}
