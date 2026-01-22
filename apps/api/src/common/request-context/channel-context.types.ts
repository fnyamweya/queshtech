import { Request } from 'express';
import { RequestContextChannel } from './request-context.service';

export type RequestWithChannel = Request & {
  channel?: RequestContextChannel;
};
