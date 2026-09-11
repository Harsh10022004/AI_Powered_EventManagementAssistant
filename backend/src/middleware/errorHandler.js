// Central error handler: every controller can just `next(err)` (or an async
// wrapper throws) and it lands here instead of every route hand-rolling
// try/catch response formatting.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error("[error]", err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
}

// Wraps an async route handler so a rejected promise is forwarded to
// errorHandler instead of crashing the process / hanging the request.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
