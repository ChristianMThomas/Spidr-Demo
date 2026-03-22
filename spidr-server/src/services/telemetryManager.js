/**
 * Spidr Nerve Center Telemetry
 * 
 * Broadcasts real server stats to admin clients every 2 seconds via Socket.io.
 * Admins join the 'nerve-center-telemetry' room on the frontend.
 * 
 * Data emitted:
 *   cpu        - process CPU usage %
 *   ram        - process RAM usage in MB
 *   ramTotal   - total system RAM in MB
 *   ramPct     - RAM usage %
 *   uptime     - server uptime in seconds
 *   connections - active Socket.io socket count
 *   timestamp  - ISO timestamp
 */

const os       = require('os');
const pidusage = require('pidusage');

let io = null;
let interval = null;

// Rolling history for EKG charts (last 60 data points)
const history = {
  cpu:         Array(60).fill(0),
  ram:         Array(60).fill(0),
  connections: Array(60).fill(0),
};

function start(socketIo) {
  if (interval) return; // already running
  io = socketIo;

  interval = setInterval(async () => {
    try {
      // Get process CPU + memory from pidusage
      const stats = await pidusage(process.pid);

      const ramMB    = Math.round(stats.memory / 1024 / 1024);
      const ramTotal = Math.round(os.totalmem() / 1024 / 1024);
      const ramPct   = Math.round((ramMB / ramTotal) * 100);
      const cpu      = Math.round(stats.cpu * 10) / 10;

      // Count active socket connections
      const connections = io ? io.engine.clientsCount : 0;

      // Update rolling history
      history.cpu.push(cpu);         history.cpu.shift();
      history.ram.push(ramPct);      history.ram.shift();
      history.connections.push(connections); history.connections.shift();

      const payload = {
        cpu,
        ram:         ramMB,
        ramTotal,
        ramPct,
        uptime:      Math.round(process.uptime()),
        connections,
        history,
        timestamp:   new Date().toISOString(),
        nodeVersion: process.version,
        platform:    process.platform,
      };

      // Only send to admins in the telemetry room
      io.to('nerve-center-telemetry').emit('server:telemetry', payload);

    } catch (err) {
      // pidusage can throw if process is unavailable — skip silently
    }
  }, 2000);

  console.log('✓ Nerve Center telemetry started (2s broadcast)');
}

function stop() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

module.exports = { start, stop };
