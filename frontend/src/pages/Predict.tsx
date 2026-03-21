import { useEffect, useState } from 'react';
import {apiService} from "../services/land_price.tsx";
import "../styles/commonPages.css"

const PredictionPage = () => {
    interface PredictionOptions {
        prediction_range?: number[];
    }
    // interface InterfaceOptions {
        
    // }
    interface DataObj {
        region: string,
        indicator: string,
        year: number
    }
    
    const [regions, setRegions] = useState<string[]>([]);
    const [predictOptions, setPredictOptions] = useState<PredictionOptions>({});
    const [indicatorOptions, setIndicatorOptions] = useState<Record<string, string>>({});
    const [dataObj, setDataObj] = useState<DataObj>({
        region: '',
        indicator: '',
        year: 2025
    });
    function updateData(e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>, action: string){
        if(action === "region"){
            const reg = e?.target?.value;
            setDataObj(dataObj => ({
                ...dataObj,
                region: reg
            }))
        } else if(action === "indicator"){
            const ind = e?.target?.value;
            setDataObj(dataObj => ({
                ...dataObj,
                indicator: ind
            }))
        } else if(action === "year"){
            const y = e?.target?.value;
            setDataObj(dataObj => ({
                ...dataObj,
                year: Number(y)
            }))
        } else {
            console.log("INVALID ACTION")
        }
    }

    async function getPrediction(){
        if(dataObj.year >= 2025 && dataObj.year <=2035){
            const prediction = await apiService.getPredictedPrice(dataObj.region, dataObj.indicator, dataObj.year);
            console.log("Prediction:", prediction)
        } else {
            console.log("Invalid Year")
        }
    }

    useEffect(()=>{
        async function getOptions() {
            try {
                const response = await apiService.getRegions();
                setRegions(response);
                const predictOptions = await apiService.getPredictOptions();
                setPredictOptions(predictOptions);
                const indicators = await apiService.getIndicatorOptions();
                setIndicatorOptions(indicators);

            } catch (err) {
                console.error("Error in getRegions>> Predict page: ", err)
            }
        }
        getOptions()
    }, [])

    return (
        <div className="h-full w-full relative ">
            <div className="sample">
                <select name="region" value={dataObj.region} id="region" onChange={(e)=> updateData(e, "region")}>
                    <option value="" disabled> Select a Region </option> 
                    {regions.map((region)=>{
                        return (
                            <option value={region} id={region}>{region}</option>
                        )
                    })}
                </select>
                <select name="indicator" value={dataObj.indicator} id="indicator" onChange={(e)=> updateData(e, "indicator")}>
                    <option value="" disabled> Select a Indicator </option> 
                    {Object.keys(indicatorOptions).map((indicator)=>{
                        return (
                            <option value={indicator} id={indicator}>{indicatorOptions[indicator]}</option>
                        )
                    })}
                </select>
                <input type="number" defaultValue={2025} min={predictOptions?.prediction_range?.[0] || 2025} max={predictOptions?.prediction_range?.[1] || 2035} onChange={(e) => updateData(e, "year")} />
                <button onClick={() => getPrediction()}>Predict</button>
            </div>
        </div>
    )
}

export default PredictionPage;