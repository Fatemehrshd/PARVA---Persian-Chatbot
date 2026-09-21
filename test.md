{
  "title": "Codeless - Load Testing & APM Performance Dashboard",
  "description": "داشبورد ارزیابی تست فشار (k6) و عملکرد سرور بر اساس گزارش رسمی: Latency، Throughput، نرخ خطا و وضعیت تفکیکی ماژول‌ها",
  "tags": [
    "codeless",
    "load-test",
    "k6",
    "latency",
    "apm",
    "signoz"
  ],
  "version": "v4",
  "variables": {
    "service": {
      "name": "service",
      "type": "QUERY",
      "description": "نام سرویس بک‌اند",
      "selectedValue": "codeless-backend",
      "defaultValue": "codeless-backend",
      "allSelected": false,
      "query": "SELECT DISTINCT service_name FROM signoz_traces.signoz_index_v3"
    }
  },
  "layout": [
    { "i": "val-p50", "x": 0, "y": 0, "w": 3, "h": 2 },
    { "i": "val-p95", "x": 3, "y": 0, "w": 3, "h": 2 },
    { "i": "val-success-rate", "x": 6, "y": 0, "w": 3, "h": 2 },
    { "i": "val-throughput", "x": 9, "y": 0, "w": 3, "h": 2 },
    { "i": "chart-latency-percentiles", "x": 0, "y": 2, "w": 6, "h": 3 },
    { "i": "chart-throughput-status", "x": 6, "y": 2, "w": 6, "h": 3 },
    { "i": "chart-feature-latency", "x": 0, "y": 5, "w": 6, "h": 3 },
    { "i": "chart-error-distribution", "x": 6, "y": 5, "w": 6, "h": 3 },
    { "i": "table-top-endpoints", "x": 0, "y": 8, "w": 12, "h": 4 }
  ],
  "widgets": [
    {
      "id": "val-p50",
      "title": "Median Latency (p50)",
      "description": "میانه زمان پاسخ‌دهی کل سیستم (هدف: زیر ۵۰۰ میلی‌ثانیه)",
      "panelType": "value",
      "query": {
        "queryType": "builder",
        "builder": {
          "queryData": [
            {
              "queryName": "p50",
              "dataSource": "traces",
              "aggregateOperator": "p50",
              "aggregateAttribute": {
                "dataType": "float64",
                "isColumn": true,
                "key": "durationNano",
                "type": "tag"
              },
              "timeAggregation": "p50",
              "spaceAggregation": "p50",
              "functions": [],
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": {
                      "dataType": "string",
                      "isColumn": true,
                      "key": "serviceName",
                      "type": "tag"
                    },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": [],
              "reduceTo": "p50"
            }
          ]
        }
      },
      "unit": "ns",
      "thresholds": [
        { "color": "#10B981", "value": 0 },
        { "color": "#F59E0B", "value": 500000000 },
        { "color": "#EF4444", "value": 1500000000 }
      ]
    },
    {
      "id": "val-p95",
      "title": "p95 Latency (چارک ۹۵ام)",
      "description": "زمان پاسخ‌دهی در بدترین ۵٪ ترافیک (هدف: زیر ۴ ثانیه تحت بار سنگین)",
      "panelType": "value",
      "query": {
        "queryType": "builder",
        "builder": {
          "queryData": [
            {
              "queryName": "p95",
              "dataSource": "traces",
              "aggregateOperator": "p95",
              "aggregateAttribute": {
                "dataType": "float64",
                "isColumn": true,
                "key": "durationNano",
                "type": "tag"
              },
              "timeAggregation": "p95",
              "spaceAggregation": "p95",
              "functions": [],
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": {
                      "dataType": "string",
                      "isColumn": true,
                      "key": "serviceName",
                      "type": "tag"
                    },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": [],
              "reduceTo": "p95"
            }
          ]
        }
      },
      "unit": "ns",
      "thresholds": [
        { "color": "#10B981", "value": 0 },
        { "color": "#F59E0B", "value": 3500000000 },
        { "color": "#EF4444", "value": 6000000000 }
      ]
    },
    {
      "id": "val-success-rate",
      "title": "Check Success Rate",
      "description": "درصد سلامت و موفقیت درخواست‌ها تحت تست فشار (هدف: بالای ۹۹٪)",
      "panelType": "value",
      "query": {
        "queryType": "clickhouse_sql",
        "clickhouse_sql": [
          {
            "name": "success_rate",
            "query": "SELECT round((countIf(status_code != 2) / count()) * 100, 2) AS value FROM signoz_traces.signoz_index_v3 WHERE service_name = 'codeless-backend' AND timestamp >= now() - INTERVAL 1 HOUR"
          }
        ]
      },
      "unit": "percent",
      "thresholds": [
        { "color": "#EF4444", "value": 0 },
        { "color": "#F59E0B", "value": 95 },
        { "color": "#10B981", "value": 99 }
      ]
    },
    {
      "id": "val-throughput",
      "title": "Throughput (RPS)",
      "description": "تعداد درخواست‌های پردازش‌شده در ثانیه",
      "panelType": "value",
      "query": {
        "queryType": "builder",
        "builder": {
          "queryData": [
            {
              "queryName": "rps",
              "dataSource": "traces",
              "aggregateOperator": "rate",
              "timeAggregation": "rate",
              "functions": [],
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": {
                      "dataType": "string",
                      "isColumn": true,
                      "key": "serviceName",
                      "type": "tag"
                    },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": [],
              "reduceTo": "avg"
            }
          ]
        }
      },
      "unit": "reqps"
    },
    {
      "id": "chart-latency-percentiles",
      "title": "توزیع زمانی تاخیر (Latency Over Time: p50 / p90 / p95)",
      "description": "روند نوسان تاخیر در طول زمان آزمون برای ارزیابی پایداری Event Loop و عدم افزایش انباشتی تاخیر",
      "panelType": "graph",
      "query": {
        "queryType": "builder",
        "builder": {
          "queryData": [
            {
              "queryName": "p50",
              "legend": "p50 (میانه)",
              "dataSource": "traces",
              "aggregateOperator": "p50",
              "aggregateAttribute": {
                "dataType": "float64",
                "isColumn": true,
                "key": "durationNano",
                "type": "tag"
              },
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": { "dataType": "string", "isColumn": true, "key": "serviceName", "type": "tag" },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": []
            },
            {
              "queryName": "p90",
              "legend": "p90 (چارک ۹۰ام)",
              "dataSource": "traces",
              "aggregateOperator": "p90",
              "aggregateAttribute": {
                "dataType": "float64",
                "isColumn": true,
                "key": "durationNano",
                "type": "tag"
              },
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": { "dataType": "string", "isColumn": true, "key": "serviceName", "type": "tag" },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": []
            },
            {
              "queryName": "p95",
              "legend": "p95 (چارک ۹۵ام)",
              "dataSource": "traces",
              "aggregateOperator": "p95",
              "aggregateAttribute": {
                "dataType": "float64",
                "isColumn": true,
                "key": "durationNano",
                "type": "tag"
              },
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": { "dataType": "string", "isColumn": true, "key": "serviceName", "type": "tag" },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": []
            }
          ]
        }
      },
      "unit": "ns"
    },
    {
      "id": "chart-throughput-status",
      "title": "نرخ ترافیک ورودی به تفکیک کدهای وضعیت HTTP",
      "description": "بررسی همزمان ترافیک ۲۰۰ موفق در برابر خطاهای ۴۲۹ یا ۵۰x",
      "panelType": "graph",
      "query": {
        "queryType": "builder",
        "builder": {
          "queryData": [
            {
              "queryName": "req_by_status",
              "legend": "Status {{http_status_code}}",
              "dataSource": "traces",
              "aggregateOperator": "count",
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": { "dataType": "string", "isColumn": true, "key": "serviceName", "type": "tag" },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": [
                {
                  "dataType": "string",
                  "isColumn": false,
                  "key": "http.status_code",
                  "type": "tag"
                }
              ]
            }
          ]
        }
      },
      "unit": "short"
    },
    {
      "id": "chart-feature-latency",
      "title": "زمان پاسخ‌دهی به تفکیک بخش‌های سیستم (Feature Area Latency)",
      "description": "مقایسه Latency در ۳ حوزه اصلی: احراز هویت (Auth)، عملیات خواندن (Reads) و جریان چت (Chat Flow)",
      "panelType": "graph",
      "query": {
        "queryType": "clickhouse_sql",
        "clickhouse_sql": [
          {
            "name": "feature_latency",
            "legend": "{{feature_area}}",
            "query": "SELECT toStartOfInterval(timestamp, INTERVAL 10 SECOND) AS ts, multiIf(has(string_tag_keys, 'http.route') AND arrayElement(string_tag_values, indexOf(string_tag_keys, 'http.route')) LIKE '%/auth/%', '۱. احراز هویت (Auth)', has(string_tag_keys, 'http.route') AND (arrayElement(string_tag_values, indexOf(string_tag_keys, 'http.route')) LIKE '%/chat/%' OR arrayElement(string_tag_values, indexOf(string_tag_keys, 'http.route')) LIKE '%/messages%'), '۳. جریان چت و پیام (Chat Flow)', '۲. خواندن اطلاعات (Reads)') AS feature_area, round(quantile(0.50)(duration_nano) / 1000000, 2) AS p50_ms FROM signoz_traces.signoz_index_v3 WHERE service_name = 'codeless-backend' GROUP BY ts, feature_area ORDER BY ts ASC"
          }
        ]
      },
      "unit": "ms"
    },
    {
      "id": "chart-error-distribution",
      "title": "توزیع خطاهای سیستم تحت بار (Error Breakdown)",
      "description": "بررسی ریشه‌ای خطاها در اوج پیک ترافیک (عدم وجود خطای دیتابیس پس از ارتقای Pool)",
      "panelType": "bar",
      "query": {
        "queryType": "builder",
        "builder": {
          "queryData": [
            {
              "queryName": "errors",
              "legend": "{{error_message}}",
              "dataSource": "traces",
              "aggregateOperator": "count",
              "filters": {
                "items": [
                  {
                    "id": "f1",
                    "key": { "dataType": "string", "isColumn": true, "key": "serviceName", "type": "tag" },
                    "op": "IN",
                    "value": ["codeless-backend"]
                  },
                  {
                    "id": "f2",
                    "key": { "dataType": "string", "isColumn": true, "key": "hasError", "type": "tag" },
                    "op": "IN",
                    "value": ["true"]
                  }
                ],
                "op": "AND"
              },
              "groupBy": [
                {
                  "dataType": "string",
                  "isColumn": false,
                  "key": "error.message",
                  "type": "tag"
                }
              ]
            }
          ]
        }
      },
      "unit": "short"
    },
    {
      "id": "table-top-endpoints",
      "title": "جدول جامع عملکرد کلیه اندپوینت‌ها (Endpoint Performance & Latency Matrix)",
      "description": "جدول آماری تفکیکی شامل نام روت، تعداد فراخوانی، میانه تاخیر، p95 و نرخ خطا",
      "panelType": "table",
      "query": {
        "queryType": "clickhouse_sql",
        "clickhouse_sql": [
          {
            "name": "endpoints_table",
            "query": "SELECT arrayElement(string_tag_values, indexOf(string_tag_keys, 'http.route')) AS endpoint, arrayElement(string_tag_values, indexOf(string_tag_keys, 'http.method')) AS method, count() AS total_requests, round(quantile(0.50)(duration_nano) / 1000000, 1) AS p50_ms, round(quantile(0.95)(duration_nano) / 1000000, 1) AS p95_ms, round(max(duration_nano) / 1000000, 1) AS max_ms, countIf(status_code = 2) AS errors, concat(toString(round((countIf(status_code = 2) / count()) * 100, 2)), '%') AS error_rate FROM signoz_traces.signoz_index_v3 WHERE service_name = 'codeless-backend' AND has(string_tag_keys, 'http.route') GROUP BY endpoint, method ORDER BY total_requests DESC"
          }
        ]
  ]
}
