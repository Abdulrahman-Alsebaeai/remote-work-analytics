import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, { count: number; sum: number }>();
  observe(method: string, route: string, status: number, durationSeconds: number) {
    const labels = `method="${method}",route="${route}",status="${status}"`;
    this.requests.set(labels, (this.requests.get(labels) ?? 0) + 1);
    const durationLabels = `method="${method}",route="${route}"`;
    const duration = this.durations.get(durationLabels) ?? { count: 0, sum: 0 };
    duration.count += 1; duration.sum += durationSeconds; this.durations.set(durationLabels, duration);
  }
  render() {
    const memory = process.memoryUsage();
    const lines = ['# HELP remote_work_uptime_seconds Process uptime.', '# TYPE remote_work_uptime_seconds gauge', `remote_work_uptime_seconds ${(Date.now() - this.startedAt) / 1000}`, '# HELP remote_work_memory_bytes Process resident memory.', '# TYPE remote_work_memory_bytes gauge', `remote_work_memory_bytes ${memory.rss}`, '# HELP remote_work_http_requests_total HTTP requests.', '# TYPE remote_work_http_requests_total counter'];
    for (const [labels, count] of this.requests) lines.push(`remote_work_http_requests_total{${labels}} ${count}`);
    lines.push('# HELP remote_work_http_request_duration_seconds HTTP request duration.', '# TYPE remote_work_http_request_duration_seconds summary');
    for (const [labels, value] of this.durations) lines.push(`remote_work_http_request_duration_seconds_count{${labels}} ${value.count}`, `remote_work_http_request_duration_seconds_sum{${labels}} ${value.sum}`);
    return `${lines.join('\n')}\n`;
  }
}
