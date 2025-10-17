import https from 'https';
import { db } from './database';
import { createLogger } from './utils/logger';

const logger = createLogger('alerting');

interface AlertConfig {
  slackWebhookUrl: string | null;
  emailApiKey: string | null;
  emailFrom: string;
  emailTo: string | null;
  alertCooldownMs: number;
}

// Alerting configuration
const config: AlertConfig = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,
  emailApiKey: process.env.SENDGRID_API_KEY || null,
  emailFrom: process.env.ALERT_EMAIL_FROM || 'alerts@bore.com',
  emailTo: process.env.ALERT_EMAIL_TO || null,
  alertCooldownMs: 5 * 60 * 1000, // 5 minutes between alerts for same instance
};

// Track last alert time per instance to avoid spam
const lastAlertTime = new Map<string, number>();

/**
 * Send alert via Slack webhook
 */
async function sendSlackAlert(message: string, color: string = '#ff0000'): Promise<void> {
  if (!config.slackWebhookUrl) return;
  
  const payload = JSON.stringify({
    attachments: [{
      color: color,
      text: message,
      ts: Math.floor(Date.now() / 1000)
    }]
  });
  
  const url = new URL(config.slackWebhookUrl);
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Slack API returned ${res.statusCode}`));
      }
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send alert via email (SendGrid)
 */
async function sendEmailAlert(subject: string, body: string): Promise<void> {
  if (!config.emailApiKey || !config.emailTo) return;
  
  const payload = JSON.stringify({
    personalizations: [{
      to: [{ email: config.emailTo }]
    }],
    from: { email: config.emailFrom },
    subject: subject,
    content: [{
      type: 'text/plain',
      value: body
    }]
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.emailApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`SendGrid API returned ${res.statusCode}`));
      }
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Check if alert cooldown has passed
 */
function canSendAlert(instanceId: string): boolean {
  const lastTime = lastAlertTime.get(instanceId);
  if (!lastTime) return true;
  return (Date.now() - lastTime) > config.alertCooldownMs;
}

/**
 * Main alert function - sends to all configured channels
 */
async function sendAlert(instanceId: string, instanceName: string, alertType: string, message: string): Promise<void> {
  // Check cooldown to avoid spam
  if (!canSendAlert(instanceId)) {
    logger.debug(`Alert cooldown active for ${instanceId}, skipping`, { instanceId });
    return;
  }
  
  lastAlertTime.set(instanceId, Date.now());
  
  const fullMessage = `🚨 *${alertType}*\nInstance: ${instanceName} (${instanceId})\n${message}`;
  
  // Send to Slack
  if (config.slackWebhookUrl) {
    try {
      await sendSlackAlert(fullMessage, getAlertColor(alertType));
      logger.info('Slack alert sent successfully', { instanceId, instanceName, alertType });
    } catch (error) {
      logger.error('Failed to send Slack alert', error as Error, { instanceId, instanceName, alertType });
    }
  }
  
  // Send to Email
  if (config.emailApiKey && config.emailTo) {
    try {
      const subject = `[Bore Alert] ${alertType}: ${instanceName}`;
      await sendEmailAlert(subject, fullMessage);
      logger.info('Email alert sent successfully', { instanceId, instanceName, alertType });
    } catch (error) {
      logger.error('Failed to send email alert', error as Error, { instanceId, instanceName, alertType });
    }
  }
  
  // Save to database
  try {
    await db.saveAlert(instanceId, alertType, message);
  } catch (error) {
    logger.error('Failed to save alert to database', error as Error, { instanceId, alertType });
  }
}

/**
 * Get alert color based on type
 */
function getAlertColor(alertType: string): string {
  const colors: Record<string, string> = {
    'Instance Offline': '#ff0000',       // Red
    'Instance Degraded': '#ff9900',      // Orange
    'Instance Idle': '#0099ff',          // Blue
    'Instance Recovered': '#00ff00',     // Green
    'High Error Rate': '#ff0000',        // Red
  };
  return colors[alertType] || '#808080';  // Gray default
}

/**
 * Pre-defined alert templates
 */
const alerts = {
  offline: (instanceId: string, instanceName: string) => 
    sendAlert(instanceId, instanceName, 'Instance Offline', 
      'The instance has gone offline. Tunnel connection lost.'),
  
  degraded: (instanceId: string, instanceName: string) => 
    sendAlert(instanceId, instanceName, 'Instance Degraded', 
      'VSCode is not responding. The instance may be frozen.'),
  
  idle: (instanceId: string, instanceName: string) => 
    sendAlert(instanceId, instanceName, 'Instance Idle', 
      'No activity detected for over 30 minutes. Consider hibernating.'),
  
  recovered: (instanceId: string, instanceName: string) => 
    sendAlert(instanceId, instanceName, 'Instance Recovered', 
      'The instance is back online and healthy.'),
  
  highErrorRate: (instanceId: string, instanceName: string, errorCount: number) => 
    sendAlert(instanceId, instanceName, 'High Error Rate', 
      `${errorCount} errors detected in the last 5 minutes.`),
};

export { sendAlert, alerts, config };
