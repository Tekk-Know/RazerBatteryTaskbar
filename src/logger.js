const pino = require('pino');
var stream = require('logrotate-stream');

toLogFile = stream({ file: './app.log', size: '100k', keep: 1 });

module.exports = pino({
  level: process.env.PINO_LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return {
        level: label.toUpperCase()
      };
    },
    bindings: (bindings) => {
      return {
        node_version: process.version,
      };
    }
  },
  transport: {
    target: 'pino/file',
    options: {
      colorize: true,
      destination: `${__dirname}/${toLogFile.file}`
    }
  },
  redact: ['hostname', 'pid'],
  timestamp: pino.stdTimeFunctions.isoTime,
});