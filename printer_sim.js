const bluetooth = require("node-bluetooth");

// Create a new Bluetooth serial port server instance
const server = new bluetooth.BluetoothSerialPortServer();

console.log("🚀 Node.js Virtual Thermal Printer Online!");
console.log("📡 Advertising SPP channel... Listening for MandarClerkApp...");

// The default Serial Port Profile (SPP) UUID that matches your mobile app's core link
const SPP_UUID = "00001101-0000-1000-8000-00805f9b34fb";

server.listen(
  (clientSocket) => {
    console.log(
      `\n🤝 Handshake successful! Connected to incoming mobile phone layout.`,
    );

    // Intercept data streams sent from your phone
    clientSocket.on("data", (buffer) => {
      const rawString = buffer.toString("utf-8");

      console.log("\n--- INCOMING PRINT JOB RECEIVED ---");
      // Clean up visual formatting strings for the terminal screen
      console.log(rawString.replace(/[\x1b\x1d][\x00-\x7f]/g, ""));
      console.log("-----------------------------------");
    });

    clientSocket.on("close", () => {
      console.log(
        "🔌 Phone disconnected cleanly. Ready for next ticket pass...",
      );
    });

    clientSocket.on("error", (err) => {
      console.error("❌ Socket Data Stream Error:", err.message);
    });
  },
  (err) => {
    console.error("❌ Failed to bind to Mac Bluetooth antenna:", err);
  },
  {
    uuid: SPP_UUID,
    channel: 1,
  },
);
