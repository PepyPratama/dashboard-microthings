const chartCtx = document.getElementById("sensorChart").getContext("2d");
let sensorChart = new Chart(chartCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Data Sensor",
      data: [],
      fill: false,
      borderColor: "rgb(255, 99, 132)",
      tension: 0.1,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
  },
});

const dropdown = document.getElementById("sensorDropdown");
const toggleSensor = document.getElementById("toggleSensor");

let currentSensor = "";
let sensorData = {};
let chartInterval = null;

// Update Chart
function updateChart(sensor) {
  if (!sensorData[sensor]) return;

  const now = new Date();
  sensorChart.data.labels.push(now.toLocaleTimeString());
  sensorChart.data.datasets[0].data.push(sensorData[sensor].value);

  if (sensorChart.data.labels.length > 20) {
    sensorChart.data.labels.shift();
    sensorChart.data.datasets[0].data.shift();
  }

  sensorChart.update();
}

// Handle Sensor Selection
dropdown.addEventListener("change", () => {
  currentSensor = dropdown.value;
  sensorChart.data.labels = [];
  sensorChart.data.datasets[0].data = [];
  sensorChart.data.datasets[0].label = currentSensor || "Data Sensor";
  sensorChart.update();

  clearInterval(chartInterval);
  if (currentSensor) {
    chartInterval = setInterval(() => updateChart(currentSensor), 3000);
  }
});

// WebSocket Connection (lokal)
const socket = new WebSocket("ws://localhost:5501");

socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    data.forEach((sensor) => {
      const { flag, value } = sensor;

      if (!sensorData[flag]) {
        const option = document.createElement("option");
        option.value = flag;
        option.textContent = flag;
        dropdown.appendChild(option);
      }

      sensorData[flag] = { value };
    });

  } catch (err) {
    console.error("Invalid JSON", err);
  }
};

// Jam Digital
function updateClock() {
  const clock = document.getElementById("clock");
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("id-ID");
}
setInterval(updateClock, 1000);
updateClock();

// Toggle Control
toggleSensor.addEventListener("change", () => {
  if (!currentSensor) return alert("Pilih sensor terlebih dahulu.");
  const isOn = toggleSensor.checked;

  const controlPayload = {
    sensorDatas: [
      {
        flag: currentSensor,
        value: isOn ? 1 : 0,
      },
    ],
  };

  socket.send(JSON.stringify(controlPayload));
});
