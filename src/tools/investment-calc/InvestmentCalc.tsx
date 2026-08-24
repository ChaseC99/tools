import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { calculateInvestment } from "./calculateInvestment.mjs";
import "./InvestmentCalc.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type Freq = "monthly" | "yearly";
type Timing = "beginning" | "end";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const parseNullableNumber = (value: string): number | null => {
  const stripped = value.replace(/,/g, "").trim();
  if (stripped === "") {
    return null;
  }

  const parsed = Number(stripped);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, parsed);
};

const parseNullableRate = (value: string): number | null => {
  const parsed = parseNullableNumber(value);
  if (parsed === null) {
    return null;
  }

  return Math.min(100, parsed);
};

const parseNullableYears = (value: string): number | null => {
  const stripped = value.replace(/,/g, "").trim();
  if (stripped === "") {
    return null;
  }

  const parsed = Number(stripped);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(100, Math.max(1, Math.trunc(parsed)));
};

const sanitizeMoneyInput = (value: string) => {
  const raw = value.replace(/,/g, "");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) {
    return cleaned;
  }

  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
};

const sanitizeRateInput = (value: string) => sanitizeMoneyInput(value);
const sanitizeYearsInput = (value: string) => value.replace(/\D/g, "");

const formatMoneyInput = (value: string) => {
  const parsed = parseNullableNumber(value);
  if (parsed === null) {
    return "";
  }

  return parsed.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

const formatRateInput = (value: string) => {
  const parsed = parseNullableRate(value);
  if (parsed === null) {
    return "";
  }

  return String(parsed);
};

const formatYearsInput = (value: string) => {
  const parsed = parseNullableYears(value);
  if (parsed === null) {
    return "";
  }

  return String(parsed);
};

export default function InvestmentCalc() {
  const [principalInput, setPrincipalInput] = useState("10,000");
  const [rateInput, setRateInput] = useState("7");
  const [yearsInput, setYearsInput] = useState("20");
  const [contributionInput, setContributionInput] = useState("500");
  const [freq, setFreq] = useState<Freq>("monthly");
  const [timing, setTiming] = useState<Timing>("end");

  const principal = parseNullableNumber(principalInput);
  const rate = parseNullableRate(rateInput);
  const years = parseNullableYears(yearsInput);
  const contribution = parseNullableNumber(contributionInput);

  const hasCompleteInputs =
    principal !== null && rate !== null && years !== null && contribution !== null;

  const data = useMemo(() => {
    if (!hasCompleteInputs) {
      return null;
    }

    return calculateInvestment({
      principal,
      annualRatePct: rate,
      years,
      contribution,
      contributionFrequency: freq,
      contributionTiming: timing,
    });
  }, [hasCompleteInputs, principal, rate, years, contribution, freq, timing]);

  const chartData = useMemo(() => {
    if (!data || principal === null) {
      return null;
    }

    const labels = data.rows.map((row) => String(row.year));
    let cumulativeContributions = 0;
    let cumulativeInterest = 0;

    const principalSeries = labels.map(() => principal);
    const contributionSeries = data.rows.map((row) => {
      cumulativeContributions += row.contributions;
      return cumulativeContributions;
    });
    const interestSeries = data.rows.map((row) => {
      cumulativeInterest += row.interest;
      return cumulativeInterest;
    });

    return {
      labels,
      datasets: [
        {
          label: "Starting Amount",
          data: principalSeries,
          backgroundColor: "#64748b",
          stack: "balance",
        },
        {
          label: "Contributions",
          data: contributionSeries,
          backgroundColor: "#16a34a",
          stack: "balance",
        },
        {
          label: "Interest",
          data: interestSeries,
          backgroundColor: "#4f8cff",
          stack: "balance",
        },
      ],
    };
  }, [data, principal]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
        },
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
              `${ctx.dataset.label ?? "Value"}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: "Year" },
        },
        y: {
          stacked: true,
          title: { display: true, text: "Amount" },
          ticks: {
            callback: (value: string | number) => fmt(Number(value)),
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="investment-calc ui-stack" data-gap="lg">
      <div className="inputs ui-grid">
        <label className="field ui-field">
          <span className="ui-label">Initial Amount</span>
          <div className="input-wrap">
            <span className="prefix">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={principalInput}
              onChange={(event) => setPrincipalInput(sanitizeMoneyInput(event.target.value))}
              onBlur={() => setPrincipalInput(formatMoneyInput(principalInput))}
              className="input"
              placeholder="0"
            />
          </div>
        </label>

        <label className="field ui-field">
          <span className="ui-label">Annual Return</span>
          <div className="input-wrap">
            <input
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(event) => setRateInput(sanitizeRateInput(event.target.value))}
              onBlur={() => setRateInput(formatRateInput(rateInput))}
              className="input"
              placeholder="0"
            />
            <span className="suffix">%</span>
          </div>
        </label>

        <label className="field ui-field">
          <span className="ui-label">Contribution Per {freq === "monthly" ? "Month" : "Year"}</span>
          <div className="input-wrap">
            <span className="prefix">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={contributionInput}
              onChange={(event) => setContributionInput(sanitizeMoneyInput(event.target.value))}
              onBlur={() => setContributionInput(formatMoneyInput(contributionInput))}
              className="input"
              placeholder="0"
            />
          </div>
          <div className="toggle-row ui-segmented" role="group" aria-label="Contribution frequency">
            <button
              type="button"
              onClick={() => setFreq("monthly")}
              className="ui-button"
              aria-pressed={freq === "monthly"}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setFreq("yearly")}
              className="ui-button"
              aria-pressed={freq === "yearly"}
            >
              Yearly
            </button>
          </div>
        </label>

        <label className="field ui-field">
          <span className="ui-label">Time Period</span>
          <div className="input-wrap">
            <input
              type="text"
              inputMode="numeric"
              value={yearsInput}
              onChange={(event) => setYearsInput(sanitizeYearsInput(event.target.value))}
              onBlur={() => setYearsInput(formatYearsInput(yearsInput))}
              className="input"
              placeholder="1"
            />
            <span className="suffix">years</span>
          </div>
        </label>
      </div>

      <div className="timing ui-field">
        <span className="ui-label">Contribution Timing</span>
        <div className="toggle-row ui-segmented" role="group" aria-label="Contribution timing">
          <button
            type="button"
            onClick={() => setTiming("end")}
            className="ui-button"
            aria-pressed={timing === "end"}
          >
            End of period
          </button>
          <button
            type="button"
            onClick={() => setTiming("beginning")}
            className="ui-button"
            aria-pressed={timing === "beginning"}
          >
            Beginning of period
          </button>
        </div>
      </div>

      <div className="cards ui-result-grid" aria-live="polite">
        <div className="ui-stat-card">
          <span className="ui-stat-label">Final Balance</span>
          <span className="ui-stat-value">{data ? fmt(data.finalBalance) : "--"}</span>
        </div>
        <div className="ui-stat-card">
          <span className="ui-stat-label">Total Contributions</span>
          <span className="ui-stat-value">{data ? fmt(data.totalContributions) : "--"}</span>
        </div>
        <div className="ui-stat-card">
          <span className="ui-stat-label">Total Interest</span>
          <span className="ui-stat-value">{data ? fmt(data.totalInterest) : "--"}</span>
        </div>
      </div>

      {chartData ? (
        <div className="chart-wrap ui-panel">
          <Bar data={chartData} options={chartOptions} />
        </div>
      ) : (
        <p className="ui-empty-state">Fill all inputs to render the graph.</p>
      )}

      {data ? (
        <div className="table-wrap ui-table-wrap">
          <table className="table ui-table">
            <thead>
              <tr>
                <th className="th">Year</th>
                <th className="th">Starting Balance</th>
                <th className="th">Contributions</th>
                <th className="th">Interest Earned</th>
                <th className="th">Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.year}>
                  <td className="td">{row.year}</td>
                  <td className="td">{fmt(row.starting)}</td>
                  <td className="td">{fmt(row.contributions)}</td>
                  <td className="td">{fmt(row.interest)}</td>
                  <td className="td td-strong">{fmt(row.ending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="assumption-note">
        Assumptions: annual return is treated as an effective annual rate and converted by period;
        contributions occur at the selected point in each period.
      </p>
    </div>
  );
}
