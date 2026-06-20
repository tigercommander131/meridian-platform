export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  console.error(`[${new Date().toISOString()}] ${status} ${code}:`, err.message);

  res.status(status).json({
    error: err.message || 'Internal server error',
    code,
    status,
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown',
    ...(err.details && { details: err.details }),
  });
}

export function notFound(req, res) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    status: 404,
  });
}
