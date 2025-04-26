/**
 * Logger utility for consistent logging throughout the application.
 * Provides methods for different log levels and formatted output.
 */
export class Logger {
  private context: string;
  private isDebugEnabled: boolean;

  /**
   * Creates a new Logger instance.
   *
   * @param context - The context for the logger (e.g., class name)
   * @param isDebugEnabled - Whether debug logs should be enabled
   */
  constructor(context: string, isDebugEnabled: boolean = false) {
    this.context = context;
    this.isDebugEnabled = isDebugEnabled;
  }

  /**
   * Enables or disables debug logging.
   *
   * @param enabled - Whether debug logging should be enabled
   */
  public setDebugEnabled(enabled: boolean): void {
    this.isDebugEnabled = enabled;
  }

  /**
   * Logs a debug message.
   *
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  public debug(message: string, data?: any): void {
    if (this.isDebugEnabled) {
      console.debug(`[DEBUG][${this.context}] ${message}`, data ? data : "");
    }
  }

  /**
   * Logs an info message.
   *
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  public info(message: string, data?: any): void {
    console.info(`[INFO][${this.context}] ${message}`, data ? data : "");
  }

  /**
   * Logs a warning message.
   *
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  public warn(message: string, data?: any): void {
    console.warn(`[WARN][${this.context}] ${message}`, data ? data : "");
  }

  /**
   * Logs an error message.
   *
   * @param message - The message to log
   * @param data - Optional data to include in the log
   */
  public error(message: string, data?: any): void {
    console.error(`[ERROR][${this.context}] ${message}`, data ? data : "");
  }
}
