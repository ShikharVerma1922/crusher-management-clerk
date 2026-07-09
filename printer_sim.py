import serial
import re
import time


def start_macos_serial_printer():
    # The default virtual Bluetooth serial mapping automatically provided by macOS
    PORT_PATH = '/dev/tty.Bluetooth-Incoming-Port'
    BAUD_RATE = 9600  # Standard configuration speed for thermal printers

    print("🚀 Python Virtual Thermal Printer Online (macOS Mode)!")
    print(f"📡 Monitoring native serial line: {PORT_PATH}")
    print("Waiting for MandarClerkApp to send ticket passes over the air...\n")

    while True:
        try:
            # Open the virtual incoming Bluetooth serial port channel
            with serial.Serial(PORT_PATH, BAUD_RATE, timeout=1) as ser:
                print("🤝 Incoming connection detected on Bluetooth interface!")

                raw_data = b""
                # Read until the buffer stops receiving data packet pulses
                while True:
                    incoming_bytes = ser.read(1024)
                    if not incoming_bytes:
                        if len(raw_data) > 0:
                            break  # Data transmission finished completely
                        continue
                    raw_data += incoming_bytes
                    time.sleep(0.1)  # Small pause to catch sequential packets

                if raw_data:
                    print("\n--- INCOMING PRINT JOB RECEIVED ---")
                    try:
                        decoded_text = raw_data.decode(
                            'utf-8', errors='replace')
                        # Regex strip rule to clean out raw ESC/POS formatting markers (\x1b, \x1d) for the terminal
                        clean_receipt = re.sub(
                            r'[\x1b\x1d][\x00-\x7f]', '', decoded_text)
                        print(clean_receipt)
                    except Exception as decode_err:
                        print(
                            f"⚠️ Raw print bytes (could not decode): {raw_data}")
                    print("-----------------------------------")
                    print("\n🔌 Line cleared. Re-listening for next ticket...")

        except serial.SerialException as e:
            # This exception is normal when the port is resting and waiting for a handshake
            time.sleep(1)
        except KeyboardInterrupt:
            print("\n👋 Stopping virtual thermal printer server. Goodbye!")
            break
        except Exception as general_err:
            print(f"❌ Core Loop Error: {general_err}")
            time.sleep(2)


if __name__ == "__main__":
    start_macos_serial_printer()
