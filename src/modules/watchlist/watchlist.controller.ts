import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as watchlistService from './watchlist.service';
import { addSymbolSchema, symbolParamSchema } from './watchlist.schema';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';

export async function getWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const result  = await watchlistService.getWatchlist(authReq.user.id, authReq.ctx);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function addSymbol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq   = req as AuthenticatedRequest;
    const { symbol } = addSymbolSchema.parse(req.body);
    const item       = await watchlistService.addSymbol(authReq.user.id, symbol, authReq.ctx);
    sendCreated(res, item);
  } catch (err) { next(err); }
}

export async function removeSymbol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq   = req as AuthenticatedRequest;
    const { symbol } = symbolParamSchema.parse(req.params);
    await watchlistService.removeSymbol(authReq.user.id, symbol, authReq.ctx);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) { next(err); }
}
