import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiService } from "../services/land_price";
import { getIndicatorMeta, formatIndicatorValue } from "../utils/indicatorMeta";
import { useStaggerReveal } from "../hooks/useStaggerReveal";
import "../styles/commonPages.css";

type TimeSeriesRow = {
    region: string;
    year: number;
    value: number;
    moving_average?: number;
    growth_yoy?: number;
};

type RegionStatRow = {
    region: string;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    count: number;
};

type CorrelationPair = {
    x: string;
    y: string;
    corr: number;
};

const AnalyticsPage = () => {
    const analyticsRef = useRef<HTMLDivElement | null>(null);
    useStaggerReveal(analyticsRef, ".analytics-animate", 20);

    const [regions, setRegions] = useState<string[]>([]);
    const [indicatorOptions, setIndicatorOptions] = useState<Record<string, string>>({});
    const [predictionRange, setPredictionRange] = useState<[number, number]>([2025, 2035]);

    const [region, setRegion] = useState("");
    const [indicator, setIndicator] = useState("");
    const [insight, setInsight] = useState("");
    const [maWindow, setMaWindow] = useState<3 | 5>(3);
    const [year, setYear] = useState(2030);

    const [timeSeries, setTimeSeries] = useState<TimeSeriesRow[]>([]);
    const [outliers, setOutliers] = useState<Array<{ region: string; year: number; value: number }>>([]);
    const [topPairs, setTopPairs] = useState<CorrelationPair[]>([]);
    const [regionStats, setRegionStats] = useState<RegionStatRow[]>([]);
    const [loading, setLoading] = useState(false);

    const indicatorLabel = indicatorOptions[indicator] ?? "Indicator";
    const insightLabel = indicatorOptions[insight] ?? "Insight";
    const indicatorMeta = useMemo(() => getIndicatorMeta(indicator, indicatorLabel), [indicator, indicatorLabel]);
    const insightMeta = useMemo(() => getIndicatorMeta(insight, insightLabel), [insight, insightLabel]);

    const formatIndicator = (value: unknown) => formatIndicatorValue(value, indicatorMeta);
    const formatInsight = (value: unknown) => formatIndicatorValue(value, insightMeta);

    useEffect(() => {
        async function init() {
            try {
                const [regionsResponse, indicatorsResponse, predictOptionsResponse] = await Promise.all([
                    apiService.getRegions(),
                    apiService.getIndicatorOptions(),
                    apiService.getPredictOptions(),
                ]);

                const safeRegions = Array.isArray(regionsResponse) ? regionsResponse : [];
                const safeIndicators = indicatorsResponse && typeof indicatorsResponse === "object"
                    ? indicatorsResponse as Record<string, string>
                    : {};

                const indicatorKeys = Object.keys(safeIndicators);
                const defaultRegion = safeRegions.includes("London") ? "London" : (safeRegions[0] ?? "");
                const defaultIndicator = indicatorKeys.includes("housing") ? "housing" : (indicatorKeys[0] ?? "");

                setRegions(safeRegions);
                setIndicatorOptions(safeIndicators);
                setRegion(defaultRegion);
                setIndicator(defaultIndicator);
                setInsight(defaultIndicator);

                if (predictOptionsResponse && typeof predictOptionsResponse === "object") {
                    const range = (predictOptionsResponse as Record<string, unknown>).prediction_range;
                    if (Array.isArray(range) && range.length === 2 && typeof range[0] === "number" && typeof range[1] === "number") {
                        setPredictionRange([range[0], range[1]]);
                        setYear(Math.min(Math.max(2030, range[0]), range[1]));
                    }
                }
            } catch (error) {
                console.error("Failed to initialize analytics page:", error);
            }
        }

        void init();
    }, []);

    useEffect(() => {
        if (!indicator || !insight) {
            return;
        }

        async function loadAnalytics() {
            setLoading(true);
            try {
                const selectedIndicatorSet = Object.keys(indicatorOptions).slice(0, 5);
                const correlationIndicators = selectedIndicatorSet.length > 1
                    ? selectedIndicatorSet
                    : [indicator, insight].filter(Boolean);

                const [timeseriesResponse, outliersResponse, correlationResponse, statsResponse] = await Promise.all([
                    apiService.getTimeSeries(indicator, region || undefined, maWindow),
                    apiService.getOutliers(indicator),
                    apiService.getCorrelation(correlationIndicators),
                    apiService.getRegionStats(insight),
                ]);

                const tsSource = timeseriesResponse && typeof timeseriesResponse === "object"
                    ? timeseriesResponse as Record<string, unknown>
                    : {};
                const tsRows = Array.isArray(tsSource.series) ? tsSource.series : [];

                const parsedSeries = tsRows
                    .map((row) => {
                        if (!row || typeof row !== "object") {
                            return null;
                        }
                        const entry = row as Record<string, unknown>;
                        const parsedYear = Number(entry.year);
                        const parsedValue = Number(entry.value);
                        const parsedMa = entry.moving_average !== undefined ? Number(entry.moving_average) : undefined;
                        const parsedGrowth = entry.growth_yoy !== undefined ? Number(entry.growth_yoy) : undefined;

                        if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedValue)) {
                            return null;
                        }

                        const parsedRow: TimeSeriesRow = {
                            region: String(entry.region ?? "Unknown"),
                            year: parsedYear,
                            value: parsedValue,
                            moving_average: Number.isFinite(parsedMa ?? Number.NaN) ? parsedMa : undefined,
                            growth_yoy: Number.isFinite(parsedGrowth ?? Number.NaN) ? parsedGrowth : undefined,
                        };

                        return parsedRow;
                    })
                    .filter((row): row is TimeSeriesRow => row !== null)
                    .sort((a, b) => a.year - b.year)
                    .filter((row) => row.year <= year);

                setTimeSeries(parsedSeries);

                const outlierSource = outliersResponse && typeof outliersResponse === "object"
                    ? outliersResponse as Record<string, unknown>
                    : {};
                const outlierRows = Array.isArray(outlierSource.outliers) ? outlierSource.outliers : [];
                const parsedOutliers = outlierRows
                    .map((row) => {
                        if (!row || typeof row !== "object") {
                            return null;
                        }
                        const entry = row as Record<string, unknown>;
                        const parsedYear = Number(entry.year);
                        const parsedValue = Number(entry.value);
                        if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedValue)) {
                            return null;
                        }
                        return {
                            region: String(entry.region ?? "Unknown"),
                            year: parsedYear,
                            value: parsedValue,
                        };
                    })
                    .filter((row): row is { region: string; year: number; value: number } => row !== null)
                    .filter((row) => row.year <= year)
                    .slice(0, 20);

                setOutliers(parsedOutliers);

                const correlationSource = correlationResponse && typeof correlationResponse === "object"
                    ? correlationResponse as Record<string, unknown>
                    : {};
                const pairRows = Array.isArray(correlationSource.top_pairs) ? correlationSource.top_pairs : [];
                const parsedPairs = pairRows
                    .map((row) => {
                        if (!row || typeof row !== "object") {
                            return null;
                        }
                        const entry = row as Record<string, unknown>;
                        const corr = Number(entry.corr);
                        if (!Number.isFinite(corr)) {
                            return null;
                        }
                        return {
                            x: String(entry.x ?? ""),
                            y: String(entry.y ?? ""),
                            corr,
                        };
                    })
                    .filter((row): row is CorrelationPair => row !== null)
                    .slice(0, 8);

                setTopPairs(parsedPairs);

                const statsSource = statsResponse && typeof statsResponse === "object"
                    ? statsResponse as Record<string, unknown>
                    : {};
                const statsObject = statsSource.stats && typeof statsSource.stats === "object"
                    ? statsSource.stats as Record<string, unknown>
                    : {};
                const statsRows = Array.isArray(statsObject[insight]) ? statsObject[insight] : [];
                const parsedStats = statsRows
                    .map((row) => {
                        if (!row || typeof row !== "object") {
                            return null;
                        }
                        const entry = row as Record<string, unknown>;
                        const mean = Number(entry.mean);
                        const median = Number(entry.median);
                        const std = Number(entry.std);
                        const min = Number(entry.min);
                        const max = Number(entry.max);
                        const count = Number(entry.count);

                        if (!Number.isFinite(mean) || !Number.isFinite(median)) {
                            return null;
                        }

                        return {
                            region: String(entry.region ?? "Unknown"),
                            mean,
                            median,
                            std: Number.isFinite(std) ? std : 0,
                            min: Number.isFinite(min) ? min : 0,
                            max: Number.isFinite(max) ? max : 0,
                            count: Number.isFinite(count) ? count : 0,
                        };
                    })
                    .filter((row): row is RegionStatRow => row !== null)
                    .slice(0, 12);

                setRegionStats(parsedStats);
            } catch (error) {
                console.error("Failed to load analytics data:", error);
            } finally {
                setLoading(false);
            }
        }

        void loadAnalytics();
    }, [indicator, indicatorOptions, insight, maWindow, region, year]);

    return (
        <div ref={analyticsRef} className="predict-page">
            <header className="predict-header analytics-animate">
                <h1>Analytics Workspace</h1>
                <p>Explore trend, outliers, correlation, and regional stats for selected indicator/region/year.</p>
            </header>

            <section className="predict-control-row analytics-animate">
                <label>
                    Region
                    <select value={region} onChange={(e) => setRegion(e.target.value)}>
                        {regions.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Indicator
                    <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
                        {Object.entries(indicatorOptions).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Insight
                    <select value={insight} onChange={(e) => setInsight(e.target.value)}>
                        {Object.entries(indicatorOptions).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    MA Window
                    <select value={maWindow} onChange={(e) => setMaWindow(Number(e.target.value) as 3 | 5)}>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                    </select>
                </label>
                <label>
                    Year
                    <input
                        type="number"
                        min={predictionRange[0]}
                        max={predictionRange[1]}
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                    />
                </label>
                <button type="button" disabled={loading}>{loading ? "Refreshing..." : "Live"}</button>
            </section>

            <section className="analytics-grid">
                <article className="panel chart-span analytics-animate">
                    <h2>{indicatorLabel} Time Series</h2>
                    <p className="panel-subtitle">GET /analytics/timeseries?indicator={indicator}&amp;region={region}&amp;ma_window={maWindow}</p>
                    <div className="chart-wrap">
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={timeSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#d2dbe6" />
                                <XAxis dataKey="year" />
                                <YAxis />
                                <Tooltip formatter={formatIndicator} />
                                <Legend />
                                <Line dataKey="value" name={indicatorLabel} stroke="#1a6f8e" strokeWidth={2.3} dot={false} />
                                <Line dataKey="moving_average" name={`MA (${maWindow})`} stroke="#6eaec8" strokeWidth={2.1} dot={false} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                <article className="panel analytics-animate">
                    <h2>Top Correlations</h2>
                    <p className="panel-subtitle">GET /analytics/correlation</p>
                    <div className="chart-wrap compact">
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={topPairs.map((row) => ({ pair: `${row.x} ~ ${row.y}`, corr: row.corr }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#d2dbe6" />
                                <XAxis dataKey="pair" hide />
                                <YAxis domain={[-1, 1]} />
                                <Tooltip formatter={(value: unknown) => typeof value === "number" ? value.toFixed(4) : "-"} />
                                <Bar dataKey="corr" fill="#2c89a9" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                <article className="panel chart-span analytics-animate">
                    <h2>{insightLabel} Region Stats</h2>
                    <p className="panel-subtitle">GET /analytics/stats/regions?indicator={insight}</p>
                    <div className="chart-wrap">
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={regionStats}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#d2dbe6" />
                                <XAxis dataKey="region" />
                                <YAxis />
                                <Tooltip formatter={formatInsight} />
                                <Legend />
                                <Bar dataKey="mean" name="Mean" fill="#1a6f8e" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="median" name="Median" fill="#6eaec8" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                <article className="panel analytics-animate">
                    <h2>Outliers</h2>
                    <p className="panel-subtitle">GET /analytics/outliers?indicator={indicator}</p>
                    <div className="analytics-table-wrap">
                        <table className="analytics-table">
                            <thead>
                                <tr>
                                    <th>Region</th>
                                    <th>Year</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={3}>No outliers for selected filters.</td>
                                    </tr>
                                ) : (
                                    outliers.map((row, idx) => (
                                        <tr key={`${row.region}-${row.year}-${idx}`}>
                                            <td>{row.region}</td>
                                            <td>{row.year}</td>
                                            <td>{formatIndicator(row.value)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            </section>
        </div>
    );
};

export default AnalyticsPage;
