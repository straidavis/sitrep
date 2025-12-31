import React, { useState, useEffect } from 'react';
import { foundrySDKService } from '../services/FoundrySDKService';
import { mapFromRaw } from '../config/schema';

const DebugSchema = () => {
    const [debugData, setDebugData] = useState({});
    const [loading, setLoading] = useState(false);

    const inspectObject = async (key, method) => {
        setLoading(true);
        try {
            let data = [];
            if (method === 'getAllFlights') data = await foundrySDKService.getAllFlights();
            else if (method === 'readDataset') data = await foundrySDKService.readDataset(key);

            const firstItem = data[0] || {};
            const rawKeys = Object.keys(firstItem).sort();

            // Try Mapping
            let mapped = {};
            try {
                mapped = mapFromRaw(key, firstItem);
            } catch (e) {
                mapped = { error: e.message };
            }

            setDebugData(prev => ({
                ...prev,
                [key]: {
                    rawKeys,
                    sample: firstItem,
                    mapped
                }
            }));
        } catch (e) {
            console.error(e);
            setDebugData(prev => ({ ...prev, [key]: { error: e.message } }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        inspectObject('flights', 'getAllFlights');
        inspectObject('equipment', 'readDataset');
        inspectObject('deployments', 'readDataset');
    }, []);

    return (
        <div className="p-10 max-w-6xl mx-auto space-y-10">
            <h1 className="text-3xl font-bold">Schema Inspector</h1>
            {loading && <div className="text-blue-500">Loading raw data...</div>}

            {Object.entries(debugData).map(([key, result]) => (
                <div key={key} className="border p-5 rounded shadow bg-gray-50">
                    <h2 className="text-xl font-bold uppercase mb-4">{key}</h2>

                    {result.error ? (
                        <div className="text-red-500">{result.error}</div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-bold underline mb-2">Raw Keys (Foundry)</h3>
                                <pre className="text-xs bg-white p-2 border h-64 overflow-auto">
                                    {JSON.stringify(result.rawKeys, null, 2)}
                                </pre>
                            </div>
                            <div>
                                <h3 className="font-bold underline mb-2">Mapped Result (App)</h3>
                                <pre className="text-xs bg-white p-2 border h-64 overflow-auto">
                                    {JSON.stringify(result.mapped, null, 2)}
                                </pre>
                            </div>
                            <div className="col-span-2">
                                <h3 className="font-bold underline mb-2">Raw Sample Data</h3>
                                <pre className="text-xs bg-black text-green-400 p-2 border rounded overflow-auto max-h-40">
                                    {JSON.stringify(result.sample, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default DebugSchema;
