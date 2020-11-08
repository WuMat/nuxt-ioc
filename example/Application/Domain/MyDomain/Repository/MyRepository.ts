import { Injectable } from '../../../../../';

interface IMyDataResponse {}

@Injectable()
export default class MyRepository {
  public async getMyData(): Promise<IMyDataResponse[]> {
    return new Promise((resolve) => {
      if (process.client) {
        setTimeout(() => resolve(['some', 'data', 'here']), 2000);
      }

      if (process.server) {
        setTimeout(() => resolve(['some', '123213', 'here']), 2000);
      }
    });
  }
}
