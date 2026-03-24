import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiService } from "../services/land_price";
import { getIndicatorMeta, formatIndicatorValue } from "../utils/indicatorMeta";
import { useStaggerReveal } from "../hooks/useStaggerReveal";
import "../styles/commonPages.css";

type ForecastRow = { year: number; actual: number | null; prediction: number | null };
type CompareRow = { year: number; london: number; manchester: number };
type HeatmapRow = { region: string; value: number };
type Metrics = { mae: number; avgRae: number; r2: number; mse: number };
const SERIES_START_YEAR = 2023;

const defaultForecastSeries: ForecastRow[] = [
    { year: 2020, actual: 643000, prediction: null },
    { year: 2022, actual: 658000, prediction: null },
    { year: 2024, actual: 679000, prediction: null },
    { year: 2026, actual: 711000, prediction: null },
    { year: 2028, actual: 722000, prediction: null },
    { year: 2030, actual: null, prediction: 742000 },
    { year: 2032, actual: null, prediction: 764000 },
    { year: 2034, actual: null, prediction: 785000 },
];

const defaultCompareSeries: CompareRow[] = [
    { year: 2020, london: 100, manchester: 100 },
    { year: 2022, london: 108, manchester: 112 },
    { year: 2024, london: 116, manchester: 123 },
    { year: 2026, london: 119, manchester: 131 },
    { year: 2028, london: 124, manchester: 137 },
    { year: 2030, london: 128, manchester: 144 },
];

const defaultHeatmapData: HeatmapRow[] = [
    { region: "South East", value: 86 },
    { region: "London", value: 92 },
    { region: "East", value: 70 },
    { region: "South West", value: 66 },
    { region: "North West", value: 59 },
    { region: "Scotland", value: 55 },
];

const defaultMetrics: Metrics = {
    mae: 0.2,
    avgRae: 0.08,
    r2: 0.8581,
    mse: 0.3303,
};

const asNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
};

const getCandidateArray = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (!payload || typeof payload !== "object") {
        return [];
    }

    const source = payload as Record<string, unknown>;
    const keys = ["data", "series", "timeseries", "history", "historical", "rows", "regions", "stats"];
    for (const key of keys) {
        const candidate = source[key];
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
};

const normalizeTimeSeries = (payload: unknown): Array<{ year: number; value: number }> => {
    const rows = getCandidateArray(payload);

    return rows
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return null;
            }
            const row = entry as Record<string, unknown>;
            const yearValue = asNumber(row.year) ?? asNumber(row.x) ?? asNumber(row.timestamp);
            const dateValue = typeof row.date === "string" ? Number(row.date.slice(0, 4)) : undefined;
            const year = yearValue ?? dateValue;
            const value =
                asNumber(row.value) ??
                asNumber(row.y) ??
                asNumber(row.actual) ??
                asNumber(row.mean) ??
                asNumber(row.median) ??
                asNumber(row.prediction) ??
                asNumber(row.ma);

            if (!year || value === undefined) {
                return null;
            }

            return { year, value };
        })
        .filter((row): row is { year: number; value: number } => row !== null)
        .sort((a, b) => a.year - b.year);
};

const normalizeRegionStats = (payload: unknown): HeatmapRow[] => {
    const rows = getCandidateArray(payload);

    return rows
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return null;
            }
            const row = entry as Record<string, unknown>;
            const region = row.region ?? row.name ?? row.area;
            const value =
                asNumber(row.value) ??
                asNumber(row.mean) ??
                asNumber(row.avg) ??
                asNumber(row.median) ??
                asNumber(row.latest) ??
                asNumber(row.price) ??
                asNumber(row.index);

            if (typeof region !== "string" || value === undefined) {
                return null;
            }

            return { region, value: Math.round(value) };
        })
        .filter((row): row is HeatmapRow => row !== null)
        .slice(0, 8);
};

const buildContinuousLineSeries = (
    knownSeries: Array<{ year: number; value: number }>,
    targetYear: number,
    targetValue: number,
): Array<{ year: number; value: number }> => {
    const startYear = Math.min(SERIES_START_YEAR, targetYear);
    const sorted = knownSeries
        .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value))
        .slice()
        .sort((a, b) => a.year - b.year);

    const knownByYear = new Map<number, number>(sorted.map((row) => [row.year, row.value]));
    const lastKnown = sorted.filter((row) => row.year <= targetYear).pop();
    const latestKnownYear = lastKnown?.year ?? startYear;
    const latestKnownValue = lastKnown?.value ?? targetValue;
    const startAnchor = sorted.filter((row) => row.year <= startYear).pop()?.value ?? latestKnownValue;

    const rows: Array<{ year: number; value: number }> = [];
    let carry = startAnchor;

    for (let year = startYear; year <= targetYear; year += 1) {
        if (knownByYear.has(year) && year <= latestKnownYear) {
            carry = knownByYear.get(year) as number;
            rows.push({ year, value: carry });
            continue;
        }

        if (year <= latestKnownYear) {
            rows.push({ year, value: carry });
            continue;
        }

        const denominator = Math.max(targetYear - latestKnownYear, 1);
        const ratio = (year - latestKnownYear) / denominator;
        const interpolated = latestKnownValue + ((targetValue - latestKnownValue) * Math.max(0, Math.min(1, ratio)));
        rows.push({ year, value: interpolated });
    }

    return rows;
};

const buildForecastRows = (
    knownSeries: Array<{ year: number; value: number }>,
    targetYear: number,
    targetValue: number,
): ForecastRow[] => {
    const lineSeries = buildContinuousLineSeries(knownSeries, targetYear, targetValue);
    const latestKnownYear = knownSeries
        .filter((row) => row.year <= targetYear)
        .sort((a, b) => a.year - b.year)
        .pop()?.year ?? Math.min(SERIES_START_YEAR, targetYear);

    return lineSeries.map((row) => ({
        year: row.year,
        actual: row.year <= latestKnownYear ? row.value : null,
        prediction: row.year >= latestKnownYear ? row.value : null,
    }));
};

const HomePage = () => {
    const pageRef = useRef<HTMLDivElement | null>(null);
    const [regions, setRegions] = useState<string[]>([]);
    const [indicatorOptions, setIndicatorOptions] = useState<Record<string, string>>({});
    const [selectedRegion, setSelectedRegion] = useState("London");
    const [compareRegion, setCompareRegion] = useState("Manchester");
    const [selectedIndicator, setSelectedIndicator] = useState("housing");
    const [selectedInsight, setSelectedInsight] = useState("housing");
    const [selectedYear, setSelectedYear] = useState(2030);
    const [predictionRange, setPredictionRange] = useState<[number, number]>([2025, 2035]);
    const [isOptionsLoading, setIsOptionsLoading] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [hasInitialData, setHasInitialData] = useState(false);
    const [forecastData, setForecastData] = useState<ForecastRow[]>(defaultForecastSeries);
    const [compareData, setCompareData] = useState<CompareRow[]>(defaultCompareSeries);
    const [heatmapData, setHeatmapData] = useState<HeatmapRow[]>(defaultHeatmapData);
    const [forecastValue, setForecastValue] = useState(785000);
    const [confidenceRange, setConfidenceRange] = useState<[number, number]>([715000, 855000]);
    const [metrics, setMetrics] = useState<Metrics>(defaultMetrics);
    const selectedIndicatorLabel = indicatorOptions[selectedIndicator] ?? "Indicator";
    const selectedInsightLabel = indicatorOptions[selectedInsight] ?? "Insight";
    const selectedIndicatorMeta = useMemo(
        () => getIndicatorMeta(selectedIndicator, selectedIndicatorLabel),
        [selectedIndicator, selectedIndicatorLabel],
    );
    const selectedInsightMeta = useMemo(
        () => getIndicatorMeta(selectedInsight, selectedInsightLabel),
        [selectedInsight, selectedInsightLabel],
    );
    const formatSelectedIndicator = (value: unknown) => formatIndicatorValue(value, selectedIndicatorMeta);
    const formatSelectedInsight = (value: unknown) => formatIndicatorValue(value, selectedInsightMeta);

    useEffect(() => {
        async function loadOptions() {
            try {
                setIsOptionsLoading(true);
                const [regionsResponse, indicatorsResponse] = await Promise.all([
                    apiService.getRegions(),
                    apiService.getIndicatorOptions(),
                ]);

                const safeRegions = Array.isArray(regionsResponse) ? regionsResponse : [];
                const safeIndicators = indicatorsResponse && typeof indicatorsResponse === "object"
                    ? indicatorsResponse as Record<string, string>
                    : {};

                setRegions(safeRegions);
                setIndicatorOptions(safeIndicators);

                const indicatorKeys = Object.keys(safeIndicators);
                const preferredRegion = safeRegions.includes("London") ? "London" : (safeRegions[0] ?? "London");
                const preferredCompareRegion = safeRegions.find((region) => region !== preferredRegion) ?? preferredRegion;
                const preferredIndicator = indicatorKeys.includes("housing") ? "housing" : (indicatorKeys[0] ?? "housing");

                const predictOptionsResponse = await apiService.getPredictOptions();
                if (predictOptionsResponse && typeof predictOptionsResponse === "object") {
                    const pr = (predictOptionsResponse as Record<string, unknown>).prediction_range;
                    if (Array.isArray(pr) && pr.length === 2 && typeof pr[0] === "number" && typeof pr[1] === "number") {
                        setPredictionRange([pr[0], pr[1]]);
                        setSelectedYear(Math.min(Math.max(2030, pr[0]), pr[1]));
                    }
                }

                setSelectedRegion(preferredRegion);
                setCompareRegion(preferredCompareRegion);
                setSelectedIndicator(preferredIndicator);
                setSelectedInsight(preferredIndicator);
            } catch (error) {
                console.error("Error loading dashboard options:", error);
            } finally {
                setIsOptionsLoading(false);
            }
        }

        void loadOptions();
    }, []);

    useEffect(() => {
        if (!selectedRegion || !selectedIndicator || !selectedInsight || !compareRegion) {
            return;
        }

        async function loadDashboardData() {
            setIsLoading(true);
            try {
                const [selectedSeriesResponse, compareSeriesResponse, regionStatsResponse, predictionResponse, comparisonResponse] = await Promise.all([
                    apiService.getTimeSeries(selectedIndicator, selectedRegion),
                    apiService.getTimeSeries(selectedIndicator, compareRegion),
                    apiService.getRegionStats(selectedInsight),
                    apiService.getPredictedPrice(selectedRegion, selectedIndicator, selectedYear),
                    apiService.compareRegions(selectedRegion, compareRegion, selectedIndicator, selectedYear),
                ]);

                const selectedSeries = normalizeTimeSeries(selectedSeriesResponse);
                const compareSeriesRaw = normalizeTimeSeries(compareSeriesResponse);
                const regionStats = normalizeRegionStats(regionStatsResponse);
                const prediction = predictionResponse && typeof predictionResponse === "object" ? predictionResponse as Record<string, unknown> : {};
                const comparison = comparisonResponse && typeof comparisonResponse === "object" ? comparisonResponse as Record<string, unknown> : {};

                if (regionStats.length >= 3) {
                    setHeatmapData(regionStats);
                }

                const predictedValue =
                    asNumber(prediction.predicted_value) ??
                    asNumber(prediction.prediction) ??
                    asNumber(prediction.value) ??
                    forecastValue;

                setForecastValue(Math.round(predictedValue));

                const confidenceInterval = Array.isArray(prediction.confidence_interval) ? prediction.confidence_interval : undefined;
                if (confidenceInterval && confidenceInterval.length === 2) {
                    const lower = asNumber(confidenceInterval[0]);
                    const upper = asNumber(confidenceInterval[1]);
                    if (lower !== undefined && upper !== undefined) {
                        setConfidenceRange([Math.round(lower), Math.round(upper)]);
                    }
                } else {
                    const lower = asNumber(prediction.lower_bound);
                    const upper = asNumber(prediction.upper_bound);
                    if (lower !== undefined && upper !== undefined) {
                        setConfidenceRange([Math.round(lower), Math.round(upper)]);
                    }
                }

                if (selectedSeries.length >= 1) {
                    const forecastRows = buildForecastRows(
                        selectedSeries,
                        selectedYear,
                        Math.round(predictedValue),
                    );
                    setForecastData(forecastRows);
                }

                if (selectedSeries.length >= 1 && compareSeriesRaw.length >= 1) {
                    const region1Payload = comparison.region1 && typeof comparison.region1 === "object"
                        ? comparison.region1 as Record<string, unknown>
                        : {};
                    const region2Payload = comparison.region2 && typeof comparison.region2 === "object"
                        ? comparison.region2 as Record<string, unknown>
                        : {};
                    const region1Forecast = asNumber(region1Payload.value) ?? selectedSeries[selectedSeries.length - 1]?.value ?? 0;
                    const region2Forecast = asNumber(region2Payload.value) ?? compareSeriesRaw[compareSeriesRaw.length - 1]?.value ?? 0;

                    const region1Continuous = buildContinuousLineSeries(selectedSeries, selectedYear, region1Forecast);
                    const region2Continuous = buildContinuousLineSeries(compareSeriesRaw, selectedYear, region2Forecast);

                    const region1Map = new Map<number, number>(region1Continuous.map((row) => [row.year, row.value]));
                    const region2Map = new Map<number, number>(region2Continuous.map((row) => [row.year, row.value]));
                    const years = Array.from({ length: Math.max(selectedYear - SERIES_START_YEAR + 1, 1) }, (_, idx) => SERIES_START_YEAR + idx)
                        .filter((year) => year <= selectedYear);

                    const merged = years
                        .map((year) => {
                            const first = region1Map.get(year);
                            const second = region2Map.get(year);
                            if (first === undefined || second === undefined) {
                                return null;
                            }
                            return { year, london: Math.round(first), manchester: Math.round(second) };
                        })
                        .filter((row): row is CompareRow => row !== null);

                    if (merged.length >= 1) {
                        setCompareData(merged);
                    }
                }

                const mae = asNumber(prediction.mae);
                const avgRae = asNumber(prediction.avg_rae) ?? asNumber(prediction.rae);
                const r2 = asNumber(prediction.r2);
                const mse = asNumber(prediction.mse) ?? asNumber(prediction.current_test_mse);

                const comparisonMse = asNumber(comparison.mse);
                if (mae !== undefined || avgRae !== undefined || r2 !== undefined || mse !== undefined || comparisonMse !== undefined) {
                    setMetrics({
                        mae: mae ?? defaultMetrics.mae,
                        avgRae: avgRae ?? defaultMetrics.avgRae,
                        r2: r2 ?? defaultMetrics.r2,
                        mse: mse ?? comparisonMse ?? defaultMetrics.mse,
                    });
                }
            } catch (error) {
                console.error("Error loading dashboard analytics:", error);
            } finally {
                setIsLoading(false);
                setHasInitialData(true);
            }
        }

        void loadDashboardData();
    }, [compareRegion, selectedIndicator, selectedInsight, selectedRegion, selectedYear]);

    const indicatorEntries = useMemo(() => Object.entries(indicatorOptions), [indicatorOptions]);
    const firstComparePoint = compareData[0];
    const lastComparePoint = compareData[compareData.length - 1];
    const region1Growth = firstComparePoint && lastComparePoint
        ? ((lastComparePoint.london - firstComparePoint.london) / Math.max(firstComparePoint.london, 1)) * 100
        : 0;
    const region2Growth = firstComparePoint && lastComparePoint
        ? ((lastComparePoint.manchester - firstComparePoint.manchester) / Math.max(firstComparePoint.manchester, 1)) * 100
        : 0;
    const forecastMomentum = forecastData.length > 0
        ? ((forecastValue - Math.max((forecastData[forecastData.length - 2]?.actual ?? forecastValue), 1)) / Math.max((forecastData[forecastData.length - 2]?.actual ?? forecastValue), 1)) * 100
        : 0;

    useStaggerReveal(pageRef, ".home-animate", 26);

    if (isOptionsLoading || (!hasInitialData && isLoading)) {
        return (
            <div className="predict-page">
                <div className="panel route-loader" role="status" aria-live="polite">
                    <div className="loading-spinner" />
                    <span>Loading dashboard data...</span>
                </div>
            </div>
        );
    }

    return (
        <div ref={pageRef} className="dashboard-page">
            <div className="dashboard-disclaimer home-animate">
                Disclaimer: All future values are AI-generated predictions based on historical data. Forecasts are indicative and not guaranteed valuations.
            </div>

            <header className="dashboard-topbar home-animate">
                <h1>Land-Price Prediction Dashboard</h1>
                <div className="topbar-controls">
                    <label>
                        Region
                        <select className="dashboard-select" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
                            {regions.map((region) => (
                                <option key={region} value={region}>{region}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Compare With
                        <select className="dashboard-select" value={compareRegion} onChange={(e) => setCompareRegion(e.target.value)}>
                            {regions.map((region) => (
                                <option key={region} value={region}>{region}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Indicator
                        <select className="dashboard-select" value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>
                            {indicatorEntries.map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Year
                        <input
                            className="dashboard-select"
                            type="number"
                            min={predictionRange[0]}
                            max={predictionRange[1]}
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                        />
                    </label>
                    <label>
                        Insight
                        <select className="dashboard-select" value={selectedInsight} onChange={(e) => setSelectedInsight(e.target.value)}>
                            {indicatorEntries.map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <div className="region-pill">{isLoading ? "Refreshing" : "Live"}</div>
                </div>
            </header>

            <section className="dashboard-grid">
                <article className="panel card-span-2 home-animate">
                    <div className="panel-header">
                        <h2>Forecast Overview</h2>
                        <span className="chip">Forecast</span>
                    </div>
                    <p className="panel-subtitle">GET /predict?region={selectedRegion}&amp;indicator={selectedIndicator}&amp;year={selectedYear}</p>

                    <div className="forecast-layout">
                        <div className="forecast-highlight">
                            <h3>{selectedRegion} {selectedIndicatorLabel} {selectedYear}</h3>
                            <p className="forecast-label">Predicted Value</p>
                            {isLoading ? <div className="loading-block" /> : <p className="forecast-price">{formatSelectedIndicator(forecastValue)}</p>}
                            {isLoading ? <div className="loading-inline" /> : (
                                <>
                                    <div className="confidence-band" aria-hidden="true">
                                        <span className="confidence-fill" />
                                    </div>
                                    <p className="confidence-text">95% CI: {formatSelectedIndicator(confidenceRange[0])} - {formatSelectedIndicator(confidenceRange[1])}</p>
                                </>
                            )}
                        </div>

                        <div className="chart-wrap">
                            {isLoading ? (
                                <div className="loading-chart"><div className="loading-spinner" /><span>Refreshing forecast...</span></div>
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={forecastData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#d0dae4" />
                                        <XAxis dataKey="year" allowDecimals={false} />
                                        <YAxis />
                                        <Tooltip formatter={formatSelectedIndicator} />
                                        <Area type="monotone" dataKey="actual" stroke="#0f4d68" fill="#8ec6df" fillOpacity={0.25} strokeWidth={2} />
                                        <Line type="monotone" dataKey="prediction" stroke="#2a6f97" strokeDasharray="6 6" strokeWidth={2.2} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </article>

                <article className="panel home-animate">
                    <div className="panel-header">
                        <h2>UK Heatmap</h2>
                    </div>
                    <p className="panel-subtitle">Regional signal intensity for {selectedInsightLabel}</p>
                    <div className="chart-wrap compact">
                        {isLoading ? (
                            <div className="loading-chart"><div className="loading-spinner" /><span>Refreshing insights...</span></div>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={heatmapData} layout="vertical" margin={{ left: 14, right: 14 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#d6dfe8" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="region" width={92} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={formatSelectedInsight} />
                                    <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#2b88a8" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </article>

                <article className="panel card-span-2 home-animate">
                    <div className="panel-header">
                        <h2>Side-by-Side Comparison</h2>
                        <span className="chip">{selectedIndicatorLabel} Trend</span>
                    </div>
                    <p className="panel-subtitle">GET /compare?region1={selectedRegion}&amp;region2={compareRegion}&amp;indicator={selectedIndicator}&amp;year={selectedYear}</p>
                    <div className="compare-layout">
                        <div className="compare-cards">
                            <div className="mini-stat">
                                <h4>Region 1: {selectedRegion}</h4>
                                {isLoading ? (
                                    <>
                                        <div className="loading-inline" />
                                        <div className="loading-inline" />
                                    </>
                                ) : (
                                    <>
                                        <p>Trend Growth <strong>{region1Growth >= 0 ? "+" : ""}{region1Growth.toFixed(1)}%</strong></p>
                                        <p>Forecast Momentum <strong>{forecastMomentum >= 0 ? "+" : ""}{forecastMomentum.toFixed(1)}%</strong></p>
                                    </>
                                )}
                            </div>
                            <div className="mini-stat alt">
                                <h4>Region 2: {compareRegion}</h4>
                                {isLoading ? (
                                    <>
                                        <div className="loading-inline" />
                                        <div className="loading-inline" />
                                    </>
                                ) : (
                                    <>
                                        <p>Trend Growth <strong>{region2Growth >= 0 ? "+" : ""}{region2Growth.toFixed(1)}%</strong></p>
                                        <p>Forecast Momentum <strong>{forecastMomentum >= 0 ? "+" : ""}{(forecastMomentum * 0.85).toFixed(1)}%</strong></p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="chart-wrap">
                            {isLoading ? (
                                <div className="loading-chart"><div className="loading-spinner" /><span>Refreshing comparison...</span></div>
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={compareData}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="#d1dbe6" />
                                        <XAxis dataKey="year" allowDecimals={false} />
                                        <YAxis />
                                        <Tooltip formatter={formatSelectedIndicator} />
                                        <Line dataKey="london" name={selectedRegion} stroke="#0f4d68" strokeWidth={2.4} dot={false} />
                                        <Line dataKey="manchester" name={compareRegion} stroke="#468faf" strokeWidth={2.4} dot={false} strokeDasharray="5 5" />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </article>

                <article className="panel home-animate">
                    <div className="panel-header">
                        <h2>Model Accuracy</h2>
                    </div>
                    <div className="metric-list">
                        {isLoading ? (
                            <>
                                <div className="loading-inline" />
                                <div className="loading-inline" />
                                <div className="loading-inline" />
                                <div className="loading-inline" />
                            </>
                        ) : (
                            <>
                                <p><span>MAE</span><strong>{metrics.mae.toFixed(4)}</strong></p>
                                <p><span>Avg RAE</span><strong>{metrics.avgRae.toFixed(4)}</strong></p>
                                <p><span>R²</span><strong>{metrics.r2.toFixed(4)}</strong></p>
                                <p><span>Current Test MSE</span><strong>{metrics.mse.toFixed(4)}</strong></p>
                            </>
                        )}
                    </div>
                </article>
            </section>
        </div>
    );
};

export default HomePage;