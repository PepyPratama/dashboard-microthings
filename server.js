const mqtt = require('mqtt');
const WebSocket = require('ws');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const PORT = process.env.WS_PORT || 8081;
const MQTT_TOPIC_IN = 'mqttout';
const MQTT_TOPIC_CONTROL = 'test/control';

const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' });

const options = {
  key: fs.readFileSync('./certs/aws-private.pem.key'),
  cert: fs.readFileSync('./certs/aws-certificate.pem.crt'),
  ca: fs.readFileSync('./certs/AmazonRootCA1.pem'),
  protocol: 'mqtts'
};

if (!process.env.MQTT_BROKER_URL) {
  console.error("❌ MQTT_BROKER_URL belum diset di file .env");
  process.exit(1);
}

const client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

// WebSocket: menerima kontrol dari frontend dan publish ke MQTT
wss.on('connection', (ws) => {
  console.log('🔗 [SERVER] WebSocket client terhubung');

  ws.on('message', (msg) => {
    console.log("📥 [SERVER] Data kontrol diterima:", msg.toString());

    try {
      const controlData = JSON.parse(msg.toString());

      if (!controlData.sensorDatas || !Array.isArray(controlData.sensorDatas)) {
        console.error("❌ [SERVER] Format data kontrol tidak valid!");
        return;
      }

      const payload = JSON.stringify(controlData);

      client.publish(MQTT_TOPIC_CONTROL, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error('❌ Gagal publish ke MQTT:', err);
        } else {
          console.log(`✅ Kontrol dikirim ke MQTT (${MQTT_TOPIC_CONTROL}):`, payload);
        }
      });

    } catch (err) {
      console.error("❌ Error parsing JSON kontrol:", err);
    }
  });
});

// MQTT: menerima data dari AWS IoT Core dan broadcast ke semua WebSocket client
client.on('connect', () => {
  console.log('✅ Terhubung ke AWS IoT Core');

  client.subscribe(MQTT_TOPIC_IN, (err) => {
    if (err) {
      console.error(`❌ Gagal subscribe ke topik ${MQTT_TOPIC_IN}:`, err);
    } else {
      console.log(`📩 Berhasil subscribe ke topik: ${MQTT_TOPIC_IN}`);
    }
  });
});

client.on('message', (topic, message) => {
  console.log(`📨 [SERVER] Data dari MQTT (${topic}):`, message.toString());

  try {
    const rawData = JSON.parse(message.toString());

    if (!rawData.sensorDatas || !Array.isArray(rawData.sensorDatas)) {
      throw new Error("sensorDatas tidak ditemukan atau bukan array");
    }

    const formattedData = rawData.sensorDatas.map(sensor => ({
      flag: sensor.flag,
      value: sensor.switcher !== undefined ? sensor.switcher : sensor.value,
      timestamp: rawData.time || Math.floor(Date.now() / 1000)
    }));

    console.log("📤 Kirim ke WebSocket:", formattedData);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(formattedData));
      }
    });

  } catch (err) {
    console.error("❌ Gagal parsing data MQTT:", err);
  }
});

client.on('error', (err) => console.error('❌ MQTT Error:', err));
client.on('close', () => console.log('🔌 MQTT koneksi ditutup'));
