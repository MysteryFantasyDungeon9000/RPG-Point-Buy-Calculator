import React, { useState, useEffect, useCallback } from 'react';

// --- Utility Functions ---
const getAbilityMod = (score) => Math.floor((score - 10) / 2);

// Array for generating score ranges in custom cost tables
const ALL_POSSIBLE_SCORES = Array.from({ length: 19 }, (_, i) => i + 2); // Generates [2, 3, ..., 20]

// --- D&D 3.5e Specific Constants ---
const STANDARD_ABILITY_COSTS_3_5E = {
    // Costs for scores below 8 (cumulative from 8) - now always 0
    2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0,
    // Standard costs from 8 to 18
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8, 16: 10, 17: 13, 18: 16,
    // Extended costs beyond 18 (common homebrew/escalating costs for higher values)
    19: 20, 20: 24,
};

// UPDATED: Added LA to races
const RACE_MODIFIERS_3_5E = {
    'Human': { la: 0 },
    'Elf': { dex: 2, con: -2, la: 0 },
    'Dwarf': { con: 2, cha: -2, la: 0 },
    'Gnome': { con: 2, str: -2, la: 0 },
    'Half-Elf': { la: 0 },
    'Half-Orc': { str: 2, int: -2, cha: -2, la: 0 },
    'Halfling': { dex: 2, str: -2, la: 0 },
    'Custom': { la: 0 }, // Custom race starts with LA 0
};

// NEW: Templates and their modifiers + LA
const TEMPLATE_MODIFIERS_3_5E = {
    'None': { la: 0 },
    'Advanced (+4 all)': { str: 4, dex: 4, con: 4, int: 4, wis: 4, cha: 4, la: 1 },
    'Half-Celestial': { str: 4, dex: 2, con: 4, int: 2, wis: 4, cha: 4, la: 4 },
    'Half-Dragon': { str: 8, con: 2, int: 2, cha: 2, la: 3 },
    'Half-Fiend': { str: 4, dex: 2, con: 4, int: 2, wis: 4, cha: 4, la: 4 },
    'Vampire': { str: 6, dex: 4, int: 2, wis: 2, cha: 4, la: 8 },
    'Custom': { la: 0 }, // Custom template starts with LA 0
};

const INITIAL_POINT_POOL_3_5E = 25;
const DEFAULT_MIN_PURCHASABLE_3_5E = 8;
const DEFAULT_MAX_PURCHASABLE_3_5E = 18;

// --- D&D 5e Specific Constants ---
const STANDARD_ABILITY_COSTS_5E = {
    // Costs for scores below 8 (cumulative from 8) - now always 0
    2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0,
    // Standard costs from 8 to 15
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
    // Extended costs beyond 15 (common homebrew/escalating costs for higher values)
    16: 12, 17: 15, 18: 19, 19: 23, 20: 28,
};
const RACE_MODIFIERS_5E = {
    'Human (Variant)': { any1: 1, any2: 1 }, // 2 +1 increases to any stats
    'Human (Standard)': { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, // +1 to all
    'Elf (High)': { dex: 2, int: 1 },
    'Dwarf (Hill)': { con: 2, wis: 1 },
    'Dwarf (Mountain)': { str: 2, con: 2 },
    'Tiefling': { int: 1, cha: 2 },
    'Dragonborn': { str: 2, cha: 1 },
    'Halfling (Lightfoot)': { dex: 2, cha: 1 },
    'Gnome (Rock)': { con: 2, int: 1 },
    'Half-Elf': { cha: 2, any1: 1, any2: 1 }, // +2 Cha, +1 to two other chosen
    'Half-Orc': { str: 2, con: 1 },
    'Custom': {},
};
const INITIAL_POINT_POOL_5E = 27;
const DEFAULT_MIN_PURCHASABLE_5E = 8;
const DEFAULT_MAX_PURCHASABLE_5E = 15;


// --- Dnd35eCalculator Component ---
const Dnd35eCalculator = ({ discordLink, paypalLink, cashappLink, feedbackEmail }) => {
    const [pointPool, setPointPool] = useState(INITIAL_POINT_POOL_3_5E);
    const [customPointPoolInput, setCustomPointPoolInput] = useState(INITIAL_POINT_POOL_3_5E);
    const [isCustomPointPool, setIsCustomPointPool] = useState(false);
    const [targetScores, setTargetScores] = useState({
        str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8,
    });
    const [selectedRace, setSelectedRace] = useState('Human');
    const [customRacialModifiers, setCustomRacialModifiers] = useState({
        str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, la: 0
    });
    const [selectedTemplate, setSelectedTemplate] = useState('None'); // NEW: For 3.5e templates
    const [customTemplateModifiers, setCustomTemplateModifiers] = useState({ // NEW: For custom templates
        str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, la: 0
    });
    const [useCustomCosts, setUseCustomCosts] = useState(false);
    const [customAbilityCosts, setCustomAbilityCosts] = useState(() => {
        const initialCosts = {};
        for (const score of ALL_POSSIBLE_SCORES) {
            initialCosts[score] = STANDARD_ABILITY_COSTS_3_5E.hasOwnProperty(score) ? STANDARD_ABILITY_COSTS_3_5E[score] : 0;
        }
        return initialCosts;
    });

    // States for min/max purchasable scores
    const [minPurchasableScore, setMinPurchasableScore] = useState(DEFAULT_MIN_PURCHASABLE_3_5E);
    const [maxPurchasableScore, setMaxPurchasableScore] = useState(DEFAULT_MAX_PURCHASABLE_3_5E);

    // Collapsible sections
    const [isRulesCollapsed, setIsRulesCollapsed] = useState(true);
    const [isTemplatesCollapsed, setIsTemplatesCollapsed] = useState(true); // NEW: For template settings
    const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(true);


    const [calculatedStats, setCalculatedStats] = useState({
        pointsSpent: 0,
        remainingPoints: INITIAL_POINT_POOL_3_5E,
        finalAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
        finalAbilityMods: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
        totalLA: 0, // NEW: Combined LA
    });

    const getCostForScore = useCallback((score) => {
        const activeCosts = useCustomCosts ? customAbilityCosts : STANDARD_ABILITY_COSTS_3_5E;
        
        if (score < 2 || score > 20 || !activeCosts.hasOwnProperty(score)) {
            return Infinity; 
        }
        return activeCosts[score];
    }, [useCustomCosts, customAbilityCosts]); 

    const handleCustomRacialModChange = (ability, value) => {
        // Ensure LA is handled correctly for custom race
        if (ability === 'la') {
            setCustomRacialModifiers(prev => ({ ...prev, [ability]: parseInt(value) || 0 }));
        } else {
            setCustomRacialModifiers(prev => ({ ...prev, [ability]: parseInt(value) || 0 }));
        }
    };

    const handleCustomTemplateModChange = (ability, value) => { // NEW: For custom template mods
        // Ensure LA is handled correctly for custom template
        if (ability === 'la') {
            setCustomTemplateModifiers(prev => ({ ...prev, [ability]: parseInt(value) || 0 }));
        } else {
            setCustomTemplateModifiers(prev => ({ ...prev, [ability]: parseInt(value) || 0 }));
        }
    };

    const handleCustomPointPoolInput = (value) => {
        const parsedValue = parseInt(value);
        if (!isNaN(parsedValue)) {
            setCustomPointPoolInput(parsedValue);
        } else if (value === '') {
            setCustomPointPoolInput('');
        }
    };

    useEffect(() => {
        if (isCustomPointPool) {
            setPointPool(parseInt(customPointPoolInput) || 0);
        }
    }, [isCustomPointPool, customPointPoolInput, setPointPool]);

    const calculateAllStats = useCallback(() => {
        let totalPointsSpent = 0;
        const finalAbilityScores = {};
        const finalAbilityMods = {};
        
        // 1. Get base scores from point buy
        for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
            const currentTargetScore = targetScores[ability];
            const cost = getCostForScore(currentTargetScore);
            if (cost !== Infinity) { 
                totalPointsSpent += cost;
            }
        }

        // Initialize scores with point-bought values
        const scoresAfterPointBuy = { ...targetScores };

        // 2. Apply Racial Modifiers
        let raceLA = 0;
        const activeRacialModifiers = selectedRace === 'Custom'
            ? customRacialModifiers
            : RACE_MODIFIERS_3_5E[selectedRace] || {};

        raceLA = activeRacialModifiers.la || 0; // Get race LA

        for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
            scoresAfterPointBuy[ability] += (activeRacialModifiers[ability] || 0);
        }

        // 3. Apply Template Modifiers (NEW)
        let templateLA = 0;
        const activeTemplateModifiers = selectedTemplate === 'Custom'
            ? customTemplateModifiers
            : TEMPLATE_MODIFIERS_3_5E[selectedTemplate] || {};
        
        templateLA = activeTemplateModifiers.la || 0; // Get template LA

        const scoresAfterAllBonuses = { ...scoresAfterPointBuy }; // Clone after race for template application
        for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
            scoresAfterAllBonuses[ability] += (activeTemplateModifiers[ability] || 0);
        }

        // Finalize scores and modifiers after all bonuses
        for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
            finalAbilityScores[ability] = scoresAfterAllBonuses[ability];
            finalAbilityMods[ability] = getAbilityMod(finalAbilityScores[ability]);
        }

        setCalculatedStats({
            pointsSpent: totalPointsSpent,
            remainingPoints: pointPool - totalPointsSpent,
            finalAbilityScores: finalAbilityScores,
            finalAbilityMods: finalAbilityMods,
            totalLA: raceLA + templateLA, // Calculate total LA
        });
    }, [pointPool, targetScores, selectedRace, customRacialModifiers, selectedTemplate, customTemplateModifiers, getCostForScore]); // Updated dependencies

    useEffect(() => {
        calculateAllStats();
    }, [calculateAllStats]);


    const adjustScore = (ability, delta) => {
        setTargetScores(prevTargetScores => {
            const newTargetScores = { ...prevTargetScores };
            const currentScore = newTargetScores[ability];
            const newScore = currentScore + delta;

            if (newScore < minPurchasableScore || newScore > maxPurchasableScore) {
                return prevTargetScores; 
            }

            const costOfNewScore = getCostForScore(newScore);
            if (costOfNewScore === Infinity) {
                return prevTargetScores;
            }

            let hypotheticalPointsSpent = 0;
            for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
                const scoreToCost = (ab === ability) ? newScore : newTargetScores[ab];
                const cost = getCostForScore(scoreToCost);
                if (cost === Infinity) { 
                    return prevTargetScores;
                }
                hypotheticalPointsSpent += cost;
            }

            if (hypotheticalPointsSpent > pointPool) {
                return prevTargetScores;
            }

            newTargetScores[ability] = newScore;
            return newTargetScores;
        });
    };

    const handleCustomCostChange = (score, value) => {
        setCustomAbilityCosts(prev => ({ ...prev, [score]: parseInt(value) || 0 }));
    };

    const handleMinMaxChange = (setterFunc, value) => { 
        const parsedValue = parseInt(value);
        if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 30) {
            setterFunc(parsedValue); 
        } else if (value === '') {
            setterFunc('');
        }
    };

    useEffect(() => {
        setTargetScores(prevScores => {
            const updatedScores = { ...prevScores };
            let changed = false;
            for (const ability in updatedScores) {
                const currentScore = updatedScores[ability];
                let newScore = currentScore;
                if (currentScore < minPurchasableScore) {
                    newScore = minPurchasableScore;
                } else if (currentScore > maxPurchasableScore) {
                    newScore = maxPurchasableScore;
                }

                if (getCostForScore(newScore) === Infinity) {
                    const minCostDefinedScore = ALL_POSSIBLE_SCORES
                                                    .filter(s => s >= minPurchasableScore && s <= maxPurchasableScore && getCostForScore(s) !== Infinity)
                                                    .sort((a,b) => a - b)[0];
                    newScore = minCostDefinedScore !== undefined ? minCostDefinedScore : DEFAULT_MIN_PURCHASABLE_3_5E;
                }


                if (newScore !== currentScore) {
                    updatedScores[ability] = newScore;
                    changed = true;
                }
            }
            let currentTotalPoints = 0;
            let needsReset = false;
            for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
                const cost = getCostForScore(updatedScores[ab]);
                if (cost === Infinity) {
                    needsReset = true;
                    break;
                }
                currentTotalPoints += cost;
            }

            if (currentTotalPoints > pointPool || needsReset) {
                const resetValue = minPurchasableScore || DEFAULT_MIN_PURCHASABLE_3_5E; 
                const safeResetValue = getCostForScore(resetValue) !== Infinity ? resetValue : DEFAULT_MIN_PURCHASABLE_3_5E;
                return {
                    str: safeResetValue, dex: safeResetValue, con: safeResetValue,
                    int: safeResetValue, wis: safeResetValue, cha: safeResetValue,
                };
            }


            return changed ? updatedScores : prevScores;
        });
    }, [minPurchasableScore, maxPurchasableScore, pointPool, getCostForScore]);


    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-center text-purple-700 dark:text-purple-400 mb-6">
                D&D 3.5e Point Buy Calculator
            </h1>

            {/* Point Pool and Race Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
                <div>
                    <label htmlFor="pointPoolSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Total Point Pool:
                    </label>
                    <select
                        id="pointPoolSelect"
                        value={isCustomPointPool ? "custom" : pointPool}
                        onChange={(e) => {
                            if (e.target.value === "custom") {
                                setIsCustomPointPool(true);
                                setCustomPointPoolInput(pointPool);
                            } else {
                                setIsCustomPointPool(false);
                                setPointPool(parseInt(e.target.value));
                            }
                        }}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value={15}>15 Points (Low Fantasy)</option>
                        <option value={25}>25 Points (Standard)</option>
                        <option value={32}>32 Points (High Fantasy)</option>
                        <option value={40}>40 Points (Epic)</option>
                        <option value="custom">Custom</option>
                    </select>
                    {isCustomPointPool && (
                        <input
                            type="number"
                            value={customPointPoolInput}
                            onChange={(e) => handleCustomPointPoolInput(e.target.value)}
                            className="mt-2 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-indigo-500 focus:border-indigo-500 text-right"
                            placeholder="Enter custom points"
                            min="0"
                        />
                    )}
                </div>
                <div>
                    <label htmlFor="raceSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Race:
                    </label>
                    <select
                        id="raceSelect"
                        value={selectedRace}
                        onChange={(e) => setSelectedRace(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        {Object.keys(RACE_MODIFIERS_3_5E).map(race => (
                            <option key={race} value={race}>
                                {race} (LA {RACE_MODIFIERS_3_5E[race].la})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Custom Race Modifiers Input */}
            {selectedRace === 'Custom' && (
                <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-500 rounded-lg shadow-inner">
                    <h2 className="text-xl md:text-2xl font-semibold text-center text-yellow-800 dark:text-yellow-200 mb-4">
                        Define Custom Racial Modifiers & LA
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => (
                            <div key={ability} className="flex items-center justify-between">
                                <label htmlFor={`custom-race-mod-${ability}`} className="text-sm font-medium text-yellow-700 dark:text-yellow-300 capitalize">
                                    {ability.toUpperCase()}:
                                </label>
                                <input
                                    id={`custom-race-mod-${ability}`}
                                    type="number"
                                    value={customRacialModifiers[ability] || 0}
                                    onChange={(e) => handleCustomRacialModChange(ability, e.target.value)}
                                    className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-yellow-500 focus:border-yellow-500"
                                />
                            </div>
                        ))}
                        <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                            <label htmlFor={`custom-race-la`} className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                LA:
                            </label>
                            <input
                                id={`custom-race-la`}
                                type="number"
                                value={customRacialModifiers.la}
                                onChange={(e) => handleCustomRacialModChange('la', e.target.value)}
                                className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-yellow-500 focus:border-yellow-500"
                            />
                        </div>
                    </div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 text-center">
                        Enter the racial bonus/penalty (e.g., enter '2' for +2, '-2' for -2).
                    </p>
                </div>
            )}

            {/* NEW: 3.5e Templates Selection and Customization */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-inner">
                <h2 className="text-xl md:text-2xl font-semibold text-center text-purple-600 dark:text-purple-300 mb-4 cursor-pointer" onClick={() => setIsTemplatesCollapsed(!isTemplatesCollapsed)}>
                    D&D 3.5e Templates
                    <span className="ml-2 text-sm">[{isTemplatesCollapsed ? 'Expand' : 'Collapse'}]</span>
                </h2>
                {!isTemplatesCollapsed && (
                    <div className="transition-all duration-300 ease-in-out">
                        <div className="mb-4">
                            <label htmlFor="templateSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select Template:
                            </label>
                            <select
                                id="templateSelect"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-purple-500 focus:border-purple-500"
                            >
                                {Object.keys(TEMPLATE_MODIFIERS_3_5E).map(template => (
                                    <option key={template} value={template}>
                                        {template} (LA {TEMPLATE_MODIFIERS_3_5E[template].la})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {selectedTemplate === 'Custom' && (
                            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-500 rounded-lg shadow-inner">
                                <h3 className="text-lg font-medium text-center text-yellow-800 dark:text-yellow-200 mb-2">
                                    Define Custom Template Modifiers & LA
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => (
                                        <div key={ability} className="flex items-center justify-between">
                                            <label htmlFor={`custom-template-mod-${ability}`} className="text-sm font-medium text-yellow-700 dark:text-yellow-300 capitalize">
                                                {ability.toUpperCase()}:
                                            </label>
                                            <input
                                                id={`custom-template-mod-${ability}`}
                                                type="number"
                                                value={customTemplateModifiers[ability] || 0}
                                                onChange={(e) => handleCustomTemplateModChange(ability, e.target.value)}
                                                className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-yellow-500 focus:border-yellow-500"
                                            />
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between col-span-2 sm:col-span-1">
                                        <label htmlFor={`custom-template-la`} className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                            LA:
                                        </label>
                                        <input
                                            id={`custom-template-la`}
                                            type="number"
                                            value={customTemplateModifiers.la}
                                            onChange={(e) => handleCustomTemplateModChange('la', e.target.value)}
                                            className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-yellow-500 focus:border-yellow-500"
                                        />
                                    </div>
                                </div>
                                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 text-center">
                                    Enter the template's ability score bonus/penalty and Level Adjustment.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Point Buy Rule Selection & Min/Max Purchasable Scores */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-inner">
                <h2 className="text-xl md:text-2xl font-semibold text-center text-indigo-600 dark:text-indigo-300 mb-4 cursor-pointer" onClick={() => setIsRulesCollapsed(!isRulesCollapsed)}>
                    Point Buy Rules Settings
                    <span className="ml-2 text-sm">[{isRulesCollapsed ? 'Expand' : 'Collapse'}]</span>
                </h2>
                {!isRulesCollapsed && (
                    <div className="transition-all duration-300 ease-in-out">
                        <div className="flex justify-center space-x-4 mb-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="pointBuyRule"
                                    value="standard"
                                    checked={!useCustomCosts}
                                    onChange={() => setUseCustomCosts(false)}
                                    className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                                />
                                <span className="ml-2 text-gray-700 dark:text-gray-300">Standard 3.5e Costs</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="pointBuyRule"
                                    value="custom"
                                    checked={useCustomCosts}
                                    onChange={() => setUseCustomCosts(true)}
                                    className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                                />
                                <span className="ml-2 text-gray-700 dark:text-gray-300">Custom Costs</span>
                            </label>
                        </div>
                        
                        {useCustomCosts && (
                            <div className="mt-4">
                                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                    Define Custom Costs (Points required to reach score)
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {ALL_POSSIBLE_SCORES.map(score => ( 
                                        <div key={score} className="flex items-center justify-between">
                                            <label htmlFor={`cost-${score}`} className="text-sm font-medium">Score {score}:</label>
                                            <input
                                                id={`cost-${score}`}
                                                type="number"
                                                value={customAbilityCosts[score]} 
                                                onChange={(e) => handleCustomCostChange(score, e.target.value)}
                                                className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-indigo-500 focus:border-indigo-500"
                                                min="-100" 
                                                max="200" 
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                                    *These costs are cumulative from score 8. Negative costs mean you gain points for lower scores.
                                </p>
                            </div>
                        )}

                        {/* Min/Max Purchasable Scores - Moved inside collapsible section */}
                        <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                Purchasable Score Limits (before racial/template bonuses)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="minScore35e" className="text-sm font-medium">Minimum Purchasable:</label>
                                    <input
                                        id="minScore35e"
                                        type="number"
                                        value={minPurchasableScore}
                                        onChange={(e) => handleMinMaxChange(setMinPurchasableScore, e.target.value)}
                                        className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-indigo-500 focus:border-indigo-500"
                                        min="1" 
                                        max="30" 
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label htmlFor="maxScore35e" className="text-sm font-medium">Maximum Purchasable:</label>
                                    <input
                                        id="maxScore35e"
                                        type="number"
                                        value={maxPurchasableScore}
                                        onChange={(e) => handleMinMaxChange(setMaxPurchasableScore, e.target.value)}
                                        className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-indigo-500 focus:border-indigo-500"
                                        min="1" 
                                        max="30" 
                                    />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                                Set the minimum/maximum base score a player can allocate using points. (Defaults: 8-18)
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Ability Score Adjustments */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-inner">
                <h2 className="text-xl md:text-2xl font-semibold text-center text-indigo-600 dark:text-indigo-300 mb-4">
                    Allocate Ability Scores
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.keys(targetScores).map((ability) => (
                        <div key={ability} className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm">
                            <span className="font-medium text-lg capitalize w-20">
                                {ability.toUpperCase()}:
                            </span>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => adjustScore(ability, -1)}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-400"
                                    aria-label={`Decrease ${ability}`}
                                >
                                    -
                                </button>
                                <span className="text-xl font-bold w-12 text-center">
                                    {targetScores[ability]}
                                </span>
                                <button
                                    onClick={() => adjustScore(ability, 1)}
                                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400"
                                    aria-label={`Increase ${ability}`}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Summary and Final Scores */}
            <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-indigo-700 dark:text-indigo-400 mb-4">
                    Summary & Final Scores
                </h2>

                <div className="flex justify-around items-center mb-6 text-xl font-bold">
                    <div className="text-center">
                        <span className="block text-gray-700 dark:text-gray-300">Points Spent:</span>
                        <span className="text-indigo-600 dark:text-indigo-300">{calculatedStats.pointsSpent}</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-gray-700 dark:text-gray-300">Points Remaining:</span>
                        <span className={`text-indigo-600 dark:text-indigo-300 ${calculatedStats.remainingPoints < 0 ? 'text-red-500' : ''}`}>
                            {calculatedStats.remainingPoints}
                        </span>
                    </div>
                    {/* NEW: Display Total LA */}
                    <div className="text-center">
                        <span className="block text-gray-700 dark:text-gray-300">Total LA:</span>
                        <span className="text-indigo-600 dark:text-indigo-300">{calculatedStats.totalLA}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-lg">
                    {Object.keys(calculatedStats.finalAbilityScores).map((ability) => (
                        <div key={ability} className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm flex flex-col items-center">
                            <span className="font-semibold text-xl capitalize mb-1">
                                {ability.toUpperCase()}
                            </span>
                            <div className="flex items-baseline space-x-1">
                                <span className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-400">
                                    {calculatedStats.finalAbilityScores[ability]}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400 text-base">
                                    ({calculatedStats.finalAbilityMods[ability] >= 0 ? '+' : ''}{calculatedStats.finalAbilityMods[ability]})
                                </span>
                            </div>
                            {/* Display racial modifiers, including LA for Custom Race */}
                            {(selectedRace !== 'Custom' && RACE_MODIFIERS_3_5E[selectedRace] && RACE_MODIFIERS_3_5E[selectedRace][ability]) ? (
                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    (Racial: {RACE_MODIFIERS_3_5E[selectedRace][ability] >= 0 ? '+' : ''}{RACE_MODIFIERS_3_5E[selectedRace][ability]})
                                </span>
                            ) : (selectedRace === 'Custom' && customRacialModifiers[ability] !== 0) ? (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    (Custom Racial: {customRacialModifiers[ability] >= 0 ? '+' : ''}{customRacialModifiers[ability]})
                                </span>
                            ) : null}
                            {/* Display template modifiers */}
                            {(selectedTemplate !== 'Custom' && TEMPLATE_MODIFIERS_3_5E[selectedTemplate] && TEMPLATE_MODIFIERS_3_5E[selectedTemplate][ability]) ? (
                                <span className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                    (Template: {TEMPLATE_MODIFIERS_3_5E[selectedTemplate][ability] >= 0 ? '+' : ''}{TEMPLATE_MODIFIERS_3_5E[selectedTemplate][ability]})
                                </span>
                            ) : (selectedTemplate === 'Custom' && customTemplateModifiers[ability] !== 0) ? (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    (Custom Template: {customTemplateModifiers[ability] >= 0 ? '+' : ''}{customTemplateModifiers[ability]})
                                </span>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>

            {/* D&D 3.5e Specific Rules and Credits */}
            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                <h3 className="text-xl md:text-2xl font-semibold text-green-600 dark:text-green-300 mb-3 cursor-pointer" onClick={() => setIsDescriptionCollapsed(!isDescriptionCollapsed)}>
                    D&D 3.5e Point Buy Rules Explanation
                    <span className="ml-2 text-sm">[{isDescriptionCollapsed ? 'Show' : 'Hide'}]</span>
                </h3>
                {!isDescriptionCollapsed && (
                    <div className="transition-all duration-300 ease-in-out">
                        <p className="mb-2 text-gray-700 dark:text-gray-300">
                            In D&D 3.5e, the point buy system allows players to customize their character's ability scores by spending a fixed pool of points. All six ability scores (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma) start at a base of 8. Points are then spent to increase these scores. Scores below 8 provide no points back.
                        </p>
                        <p className="mb-2 text-gray-700 dark:text-gray-300">
                            The cost to increase an ability score is cumulative from 8. Here is the standard cost table:
                        </p>
                        <div className="overflow-x-auto mb-4 inline-block w-full">
                            <table className="mx-auto min-w-max divide-y divide-gray-200 dark:divide-gray-700 rounded-lg overflow-hidden">
                                <thead className="bg-gray-100 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cost from 8</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {Object.entries(STANDARD_ABILITY_COSTS_3_5E).map(([score, cost]) => (
                                        <tr key={score}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{score}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {cost}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                            The typical range for purchasable attributes is {DEFAULT_MIN_PURCHASABLE_3_5E}-{DEFAULT_MAX_PURCHASABLE_3_5E} before racial modifiers, but custom limits can be set above. Common point pools include 15 (low fantasy), 25 (standard), and 32 (high fantasy).
                        </p>
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border-l-4 border-red-500 rounded-lg text-left">
                            <h3 className="text-xl md:text-2xl font-semibold text-red-700 dark:text-red-200 mb-3">
                                Important: Discuss with Your Game Master!
                            </h3>
                            <p className="text-red-600 dark:text-red-300">
                                Any deviation from the standard point buy rules (such as using custom point costs, a different total point pool, or non-standard minimum/maximum purchasable attributes) should always be discussed and agreed upon with your Game Master or Storyteller. These decisions are crucial for maintaining the balance and integrity of your campaign.
                            </p>
                        </div>
                    </div>
                )}
                <p className="mt-8">Inspired by and a grateful nod to the excellent <a href="https://chicken-dinner.com/5e/5e-point-buy.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">D&D 5e Point Buy Calculator at Chicken Dinner</a>.</p>
                <p className="mt-2">Join our community on Discord: <a href={discordLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Mystery Fantasy Dungeon 9000</a></p>
                {/* Feedback Email Link */}
                <p className="mt-2">
                    Have feedback or suggestions? Email us at: {' '}
                    <a href={`mailto:${feedbackEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline font-bold">
                        {feedbackEmail}
                    </a>
                </p>
                {paypalLink && cashappLink && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900 rounded-lg text-center">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200 mb-2">Enjoying the calculator? Consider supporting its development!</p>
                        <div className="flex justify-center space-x-4">
                            {paypalLink && (
                                <a href={paypalLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-bold">
                                    Support via PayPal
                                </a>
                            )}
                            {cashappLink && (
                                <a href={cashappLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-bold">
                                    Support via Cash App
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Dnd5eCalculator Component ---
const Dnd5eCalculator = ({ discordLink, paypalLink, cashappLink, feedbackEmail }) => {
    // 5e specific states and logic
    const [pointPool, setPointPool] = useState(INITIAL_POINT_POOL_5E); // 5e standard is 27
    const [customPointPoolInput, setCustomPointPoolInput] = useState(INITIAL_POINT_POOL_5E);
    const [isCustomPointPool, setIsCustomPointPool] = useState(false);
    const [targetScores, setTargetScores] = useState({
        str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8,
    });
    const [selectedRace, setSelectedRace] = useState('Human (Standard)'); // Default 5e human
    const [customRacialModifiers, setCustomRacialModifiers] = useState({
        str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
    });
    const [useCustomCosts, setUseCustomCosts] = useState(false);
    const [customAbilityCosts, setCustomAbilityCosts] = useState(() => {
        const initialCosts = {};
        for (const score of ALL_POSSIBLE_SCORES) {
            initialCosts[score] = STANDARD_ABILITY_COSTS_5E.hasOwnProperty(score) ? STANDARD_ABILITY_COSTS_5E[score] : 0;
        }
        return initialCosts;
    });

    // States for min/max purchasable scores
    const [minPurchasableScore, setMinPurchasableScore] = useState(DEFAULT_MIN_PURCHASABLE_5E);
    const [maxPurchasableScore, setMaxPurchasableScore] = useState(DEFAULT_MAX_PURCHASABLE_5E);

    // Collapsible rules sections
    const [isRulesCollapsed, setIsRulesCollapsed] = useState(true);
    const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(true);


    const [calculatedStats, setCalculatedStats] = useState({
        pointsSpent: 0,
        remainingPoints: INITIAL_POINT_POOL_5E,
        finalAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
        finalAbilityMods: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
    });

    // Handle 5e specific racial ability score increases (e.g., Human (Variant) chooses two +1s)
    const [selectedAnyIncreases, setSelectedAnyIncreases] = useState({ any1: '', any2: '' });

    const handleAnyIncreaseChange = (key, value) => {
        setSelectedAnyIncreases(prev => ({ ...prev, [key]: value }));
    };

    // Optional Starting Feat/ASI
    const [startingAsiOption, setStartingAsiOption] = useState('none'); // 'none', 'standard', 'halfFeat'
    const [featAsiChoices, setFeatAsiChoices] = useState({
        ability1: '', // for +2 or first +1
        ability2: '', // for second +1 (if standard ASI is two +1s)
    });

    const handleFeatAsiChange = (key, value) => {
        setFeatAsiChoices(prev => ({ ...prev, [key]: value }));
    };


    const getCostForScore = useCallback((score) => {
        const activeCosts = useCustomCosts ? customAbilityCosts : STANDARD_ABILITY_COSTS_5E;
        if (score < 2 || score > 20 || !activeCosts.hasOwnProperty(score)) {
            return Infinity;
        }
        return activeCosts[score];
    }, [useCustomCosts, customAbilityCosts]);


    const handleCustomRacialModChange = (ability, value) => {
        setCustomRacialModifiers(prev => ({ ...prev, [ability]: parseInt(value) || 0 }));
    };

    const handleCustomPointPoolInput = (value) => {
        const parsedValue = parseInt(value);
        if (!isNaN(parsedValue)) {
            setCustomPointPoolInput(parsedValue);
        } else if (value === '') {
            setCustomPointPoolInput('');
        }
    };


    useEffect(() => {
        if (isCustomPointPool) {
            setPointPool(parseInt(customPointPoolInput) || 0);
        }
    }, [isCustomPointPool, customPointPoolInput, setPointPool]);

    const calculateAllStats = useCallback(() => {
        let totalPointsSpent = 0;
        const finalAbilityScores = {};
        const finalAbilityMods = {};
        let activeRacialModifiers = {};
        if (selectedRace === 'Custom') {
            activeRacialModifiers = customRacialModifiers;
        } else {
            const baseRaceMod = RACE_MODIFIERS_5E[selectedRace] || {};
            activeRacialModifiers = { ...baseRaceMod };

            if (activeRacialModifiers.any1 && selectedAnyIncreases.any1) {
                activeRacialModifiers[selectedAnyIncreases.any1] = (activeRacialModifiers[selectedAnyIncreases.any1] || 0) + 1;
            }
            if (activeRacialModifiers.any2 && selectedAnyIncreases.any2 && selectedAnyIncreases.any2 !== selectedAnyIncreases.any1) {
                activeRacialModifiers[selectedAnyIncreases.any2] = (activeRacialModifiers[selectedAnyIncreases.any2] || 0) + 1;
            }
            delete activeRacialModifiers.any1;
            delete activeRacialModifiers.any2;
        }


        // Copy target scores for initial calculation before applying feat/ASI bonuses
        const scoresAfterPointBuyAndRace = { ...targetScores };

        for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
            const currentTargetScore = scoresAfterPointBuyAndRace[ability]; // Use base score for cost calc
            const cost = getCostForScore(currentTargetScore);
            if (cost !== Infinity) {
                totalPointsSpent += cost;
            }
        }

        // Apply Racial Modifiers FIRST
        for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
            scoresAfterPointBuyAndRace[ability] += (activeRacialModifiers[ability] || 0);
        }

        // Apply Optional Starting Feat/ASI bonuses AFTER racial modifiers
        const scoresAfterAllBonuses = { ...scoresAfterPointBuyAndRace }; // Clone to apply ASI/Feat

        if (startingAsiOption === 'standard') {
            if (featAsiChoices.ability1) {
                if (featAsiChoices.ability2 && featAsiChoices.ability1 !== featAsiChoices.ability2) {
                    // Two +1s
                    scoresAfterAllBonuses[featAsiChoices.ability1] = (scoresAfterAllBonuses[featAsiChoices.ability1] || 0) + 1;
                    scoresAfterAllBonuses[featAsiChoices.ability2] = (scoresAfterAllBonuses[featAsiChoices.ability2] || 0) + 1;
                } else if (featAsiChoices.ability1) {
                    // One +2
                    scoresAfterAllBonuses[featAsiChoices.ability1] = (scoresAfterAllBonuses[featAsiChoices.ability1] || 0) + 2;
                }
            }
        } else if (startingAsiOption === 'halfFeat') {
            if (featAsiChoices.ability1) {
                // One +1 from half-feat
                scoresAfterAllBonuses[featAsiChoices.ability1] = (scoresAfterAllBonuses[featAsiChoices.ability1] || 0) + 1;
            }
        }


        // Finalize scores and modifiers
        for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
            finalAbilityScores[ability] = scoresAfterAllBonuses[ability];
            finalAbilityMods[ability] = getAbilityMod(finalAbilityScores[ability]);
        }

        setCalculatedStats({
            pointsSpent: totalPointsSpent,
            remainingPoints: pointPool - totalPointsSpent,
            finalAbilityScores: finalAbilityScores,
            finalAbilityMods: finalAbilityMods,
        });
    }, [pointPool, targetScores, selectedRace, customRacialModifiers, getCostForScore, selectedAnyIncreases, startingAsiOption, featAsiChoices]); // Added new states to dependencies


    useEffect(() => {
        calculateAllStats();
    }, [calculateAllStats]);


    const adjustScore = (ability, delta) => {
        setTargetScores(prevTargetScores => {
            const newTargetScores = { ...prevTargetScores };
            const currentScore = newTargetScores[ability];
            const newScore = currentScore + delta;

            if (newScore < minPurchasableScore || newScore > maxPurchasableScore) {
                return prevTargetScores;
            }

            const costOfNewScore = getCostForScore(newScore);
            if (costOfNewScore === Infinity) {
                return prevTargetScores;
            }

            let hypotheticalPointsSpent = 0;
            for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
                const scoreToCost = (ab === ability) ? newScore : newTargetScores[ab];
                const cost = getCostForScore(scoreToCost);
                if (cost === Infinity) {
                    return prevTargetScores;
                }
                hypotheticalPointsSpent += cost;
            }

            if (hypotheticalPointsSpent > pointPool) {
                return prevTargetScores;
            }

            newTargetScores[ability] = newScore;
            return newTargetScores;
        });
    };

    const handleCustomCostChange = (score, value) => {
        setCustomAbilityCosts(prev => ({ ...prev, [score]: parseInt(value) || 0 }));
    };

    const handleMinMaxChange = (setterFunc, value) => {
        const parsedValue = parseInt(value);
        if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 30) {
            setterFunc(parsedValue);
        } else if (value === '') {
            setterFunc('');
        }
    };

    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    // Determine if the selected 5e race has 'any' increases (e.g., Human Variant, Half-Elf)
    const currentRaceHasAnyIncreases = (selectedRace === 'Human (Variant)' || selectedRace === 'Half-Elf');

    useEffect(() => {
        setTargetScores(prevScores => {
            const updatedScores = { ...prevScores };
            let changed = false;
            for (const ability in updatedScores) {
                const currentScore = updatedScores[ability];
                let newScore = currentScore;
                if (currentScore < minPurchasableScore) {
                    newScore = minPurchasableScore;
                } else if (currentScore > maxPurchasableScore) {
                    newScore = maxPurchasableScore;
                }

                 if (getCostForScore(newScore) === Infinity) {
                    const minCostDefinedScore = ALL_POSSIBLE_SCORES
                                                    .filter(s => s >= minPurchasableScore && s <= maxPurchasableScore && getCostForScore(s) !== Infinity)
                                                    .sort((a,b) => a - b)[0];
                    newScore = minCostDefinedScore !== undefined ? minCostDefinedScore : DEFAULT_MIN_PURCHASABLE_5E;
                 }


                if (newScore !== currentScore) {
                    updatedScores[ability] = newScore;
                    changed = true;
                }
            }
            let currentTotalPoints = 0;
            let needsReset = false;
            for (const ab of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
                const cost = getCostForScore(updatedScores[ab]);
                if (cost === Infinity) {
                    needsReset = true;
                    break;
                }
                currentTotalPoints += cost;
            }

            if (currentTotalPoints > pointPool || needsReset) {
                const resetValue = minPurchasableScore || DEFAULT_MIN_PURCHASABLE_5E;
                const safeResetValue = getCostForScore(resetValue) !== Infinity ? resetValue : DEFAULT_MIN_PURCHASABLE_5E;
                return {
                    str: safeResetValue, dex: safeResetValue, con: safeResetValue,
                    int: safeResetValue, wis: safeResetValue, cha: safeResetValue,
                };
            }

            return changed ? updatedScores : prevScores;
        });
    }, [minPurchasableScore, maxPurchasableScore, pointPool, getCostForScore]);


    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-center text-red-700 dark:text-red-400 mb-6">
                D&D 5e Point Buy Calculator
            </h1>

            {/* Point Pool and Race Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
                <div>
                    <label htmlFor="pointPoolSelect5e" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Total Point Pool:
                    </label>
                    <select
                        id="pointPoolSelect5e"
                        value={isCustomPointPool ? "custom" : pointPool}
                        onChange={(e) => {
                            if (e.target.value === "custom") {
                                setIsCustomPointPool(true);
                                setCustomPointPoolInput(pointPool);
                            } else {
                                setIsCustomPointPool(false);
                                setPointPool(parseInt(e.target.value));
                            }
                        }}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-red-500 focus:border-red-500"
                    >
                        <option value={27}>27 Points (Standard 5e)</option>
                        <option value={15}>15 Points (Low)</option>
                        <option value="custom">Custom</option>
                    </select>
                    {isCustomPointPool && (
                        <input
                            type="number"
                            value={customPointPoolInput}
                            onChange={(e) => handleCustomPointPoolInput(e.target.value)}
                            className="mt-2 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-red-500 focus:border-red-500 text-right"
                            placeholder="Enter custom points"
                            min="0"
                        />
                    )}
                </div>
                <div>
                    <label htmlFor="raceSelect5e" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Race:
                    </label>
                    <select
                        id="raceSelect5e"
                        value={selectedRace}
                        onChange={(e) => setSelectedRace(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-red-500 focus:border-red-500"
                    >
                        {Object.keys(RACE_MODIFIERS_5E).map(race => (
                            <option key={race} value={race}>{race}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Custom Race Modifiers Input for 5e */}
            {selectedRace === 'Custom' && (
                <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-500 rounded-lg shadow-inner">
                    <h2 className="text-xl md:text-2xl font-semibold text-center text-yellow-800 dark:text-yellow-200 mb-4">
                        Define Custom Racial Modifiers
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {abilities.map(ability => (
                            <div key={ability} className="flex items-center justify-between">
                                <label htmlFor={`custom-mod-5e-${ability}`} className="text-sm font-medium text-yellow-700 dark:text-yellow-300 capitalize">
                                    {ability.toUpperCase()}:
                                </label>
                                <input
                                    id={`custom-mod-5e-${ability}`}
                                    type="number"
                                    value={customRacialModifiers[ability]}
                                    onChange={(e) => handleCustomRacialModChange(ability, e.target.value)}
                                    className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-yellow-500 focus:border-yellow-500"
                                />
                            </div>
                        ))}
                    </div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 text-center">
                        Enter the racial bonus/penalty (e.g., enter '2' for +2, '-2' for -2).
                    </p>
                </div>
            )}

            {/* 5e Specific Any Increases Selection (from Human Variant/Half-Elf) */}
            {currentRaceHasAnyIncreases && (
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-500 rounded-lg shadow-inner">
                    <h2 className="text-xl md:text-2xl font-semibold text-center text-blue-800 dark:text-blue-200 mb-4">
                        Choose Racial +1 Ability Increases
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {RACE_MODIFIERS_5E[selectedRace].any1 && (
                            <div>
                                <label htmlFor="any1-select" className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                                    First +1 Increase:
                                </label>
                                <select
                                    id="any1-select"
                                    value={selectedAnyIncreases.any1}
                                    onChange={(e) => handleAnyIncreaseChange('any1', e.target.value)}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">-- Choose --</option>
                                    {abilities.map(ab => (
                                        <option key={ab} value={ab} disabled={selectedAnyIncreases.any2 === ab}>
                                            {ab.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {RACE_MODIFIERS_5E[selectedRace].any2 && (
                            <div>
                                <label htmlFor="any2-select" className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                                    Second +1 Increase:
                                </label>
                                <select
                                    id="any2-select"
                                    value={selectedAnyIncreases.any2}
                                    onChange={(e) => handleAnyIncreaseChange('any2', e.target.value)}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">-- Choose --</option>
                                    {abilities.map(ab => (
                                        <option key={ab} value={ab} disabled={selectedAnyIncreases.any1 === ab}>
                                            {ab.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5e Point Buy Rule Selection & Min/Max Purchasable Scores */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-inner">
                <h2 className="text-xl md:text-2xl font-semibold text-center text-red-600 dark:text-red-300 mb-4 cursor-pointer" onClick={() => setIsRulesCollapsed(!isRulesCollapsed)}>
                    Point Buy Rules Settings
                    <span className="ml-2 text-sm">[{isRulesCollapsed ? 'Expand' : 'Collapse'}]</span>
                </h2>
                {!isRulesCollapsed && (
                    <div className="transition-all duration-300 ease-in-out">
                        {/* Point Cost Rules (Standard/Custom) */}
                        <div className="flex justify-center space-x-4 mb-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="pointBuyRule5e"
                                    value="standard"
                                    checked={!useCustomCosts}
                                    onChange={() => setUseCustomCosts(false)}
                                    className="form-radio h-4 w-4 text-red-600 transition duration-150 ease-in-out"
                                />
                                <span className="ml-2 text-gray-700 dark:text-gray-300">Standard 5e Costs</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="pointBuyRule5e"
                                    value="custom"
                                    checked={useCustomCosts}
                                    onChange={() => setUseCustomCosts(true)}
                                    className="form-radio h-4 w-4 text-red-600 transition duration-150 ease-in-out"
                                />
                                <span className="ml-2 text-gray-700 dark:text-gray-300">Custom Costs</span>
                            </label>
                        </div>

                        {useCustomCosts && (
                            <div className="mt-4">
                                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                    Define Custom Costs (Points required to reach score)
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {ALL_POSSIBLE_SCORES.map(score => ( 
                                        <div key={score} className="flex items-center justify-between">
                                            <label htmlFor={`cost-5e-${score}`} className="text-sm font-medium">Score {score}:</label>
                                            <input
                                                id={`cost-5e-${score}`}
                                                type="number"
                                                value={customAbilityCosts[score]} 
                                                onChange={(e) => handleCustomCostChange(score, e.target.value)}
                                                className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-red-500 focus:border-red-500"
                                                min="-100" 
                                                max="200" 
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                                    *These costs are cumulative from score 8. Negative costs mean you gain points for lower scores.
                                </p>
                            </div>
                        )}

                        {/* Optional Starting Feat / ASI */}
                        <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                Optional Starting Feat / ASI
                            </h3>
                            <div className="flex justify-center space-x-4 mb-4">
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="startingAsiOption"
                                        value="none"
                                        checked={startingAsiOption === 'none'}
                                        onChange={() => {
                                            setStartingAsiOption('none');
                                            setFeatAsiChoices({ ability1: '', ability2: '' }); // Clear choices
                                        }}
                                        className="form-radio h-4 w-4 text-red-600 transition duration-150 ease-in-out"
                                    />
                                    <span className="ml-2 text-gray-700 dark:text-gray-300">None</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="startingAsiOption"
                                        value="standard"
                                        checked={startingAsiOption === 'standard'}
                                        onChange={() => setStartingAsiOption('standard')}
                                        className="form-radio h-4 w-4 text-red-600 transition duration-150 ease-in-out"
                                    />
                                    <span className="ml-2 text-gray-700 dark:text-gray-300">Standard ASI (+2 to one or +1 to two)</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="startingAsiOption"
                                        value="halfFeat"
                                        checked={startingAsiOption === 'halfFeat'}
                                        onChange={() => {
                                            setStartingAsiOption('halfFeat');
                                            setFeatAsiChoices(prev => ({ ...prev, ability2: '' })); // Clear second choice for half-feat
                                        }}
                                        className="form-radio h-4 w-4 text-red-600 transition duration-150 ease-in-out"
                                    />
                                    <span className="ml-2 text-gray-700 dark:text-gray-300">Half-Feat (+1 to one)</span>
                                </label>
                            </div>

                            {startingAsiOption !== 'none' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label htmlFor="feat-asi-ability1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {startingAsiOption === 'standard' ? 'First Ability (+1 or +2):' : 'Ability for +1:'}
                                        </label>
                                        <select
                                            id="feat-asi-ability1"
                                            value={featAsiChoices.ability1}
                                            onChange={(e) => handleFeatAsiChange('ability1', e.target.value)}
                                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-red-500 focus:border-red-500"
                                        >
                                            <option value="">-- Select Ability --</option>
                                            {abilities.map(ab => (
                                                <option key={ab} value={ab} disabled={startingAsiOption === 'standard' && featAsiChoices.ability2 === ab}>
                                                    {ab.toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {startingAsiOption === 'standard' && (
                                        <div>
                                            <label htmlFor="feat-asi-ability2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Second Ability (+1, optional):
                                            </label>
                                            <select
                                                id="feat-asi-ability2"
                                                value={featAsiChoices.ability2}
                                                onChange={(e) => handleFeatAsiChange('ability2', e.target.value)}
                                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-red-500 focus:border-red-500"
                                            >
                                                <option value="">-- Select Ability (optional) --</option>
                                                {abilities.map(ab => (
                                                    <option key={ab} value={ab} disabled={featAsiChoices.ability1 === ab}>
                                                        {ab.toUpperCase()}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Leave blank for a single +2 to the first ability.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>


                        {/* Min/Max Purchasable Scores */}
                        <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                                Purchasable Score Limits (before racial/template bonuses)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="minScore5e" className="text-sm font-medium">Minimum Purchasable:</label>
                                    <input
                                        id="minScore5e"
                                        type="number"
                                        value={minPurchasableScore}
                                        onChange={(e) => handleMinMaxChange(setMinPurchasableScore, e.target.value)}
                                        className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-red-500 focus:border-red-500"
                                        min="1" 
                                        max="30" 
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label htmlFor="maxScore5e" className="text-sm font-medium">Maximum Purchasable:</label>
                                    <input
                                        id="maxScore5e"
                                        type="number"
                                        value={maxPurchasableScore}
                                        onChange={(e) => handleMinMaxChange(setMaxPurchasableScore, e.target.value)} 
                                        className="w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right focus:ring-red-500 focus:border-red-500"
                                        min="1" 
                                        max="30" 
                                    />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                                Set the minimum/maximum base score a player can allocate using points. (Defaults: 8-15)
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Ability Score Adjustments */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-inner">
                <h2 className="text-xl md:text-2xl font-semibold text-center text-red-600 dark:text-red-300 mb-4">
                    Allocate Ability Scores
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {abilities.map((ability) => (
                        <div key={ability} className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm">
                            <span className="font-medium text-lg capitalize w-20">
                                {ability.toUpperCase()}:
                            </span>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => adjustScore(ability, -1)}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-400"
                                    aria-label={`Decrease ${ability}`}
                                >
                                    -
                                </button>
                                <span className="text-xl font-bold w-12 text-center">
                                    {targetScores[ability]}
                                </span>
                                <button
                                    onClick={() => adjustScore(ability, 1)}
                                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400"
                                    aria-label={`Increase ${ability}`}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Summary and Final Scores */}
            <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-red-700 dark:text-red-400 mb-4">
                    Summary & Final Scores
                </h2>

                <div className="flex justify-around items-center mb-6 text-xl font-bold">
                    <div className="text-center">
                        <span className="block text-gray-700 dark:text-gray-300">Points Spent:</span>
                        <span className="text-red-600 dark:text-red-300">{calculatedStats.pointsSpent}</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-gray-700 dark:text-gray-300">Points Remaining:</span>
                        <span className={`text-red-600 dark:text-red-300 ${calculatedStats.remainingPoints < 0 ? 'text-red-500' : ''}`}>
                            {calculatedStats.remainingPoints}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-lg">
                    {abilities.map((ability) => (
                        <div key={ability} className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm flex flex-col items-center">
                            <span className="font-semibold text-xl capitalize mb-1">
                                {ability.toUpperCase()}
                            </span>
                            <div className="flex items-baseline space-x-1">
                                <span className="text-3xl font-extrabold text-red-700 dark:text-red-400">
                                    {calculatedStats.finalAbilityScores[ability]}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400 text-base">
                                    ({calculatedStats.finalAbilityMods[ability] >= 0 ? '+' : ''}{calculatedStats.finalAbilityMods[ability]})
                                </span>
                            </div>
                            {/* Display racial modifiers, including 'any' for 5e */}
                            {(selectedRace !== 'Custom' && RACE_MODIFIERS_5E[selectedRace]) ? (
                                <>
                                    {RACE_MODIFIERS_5E[selectedRace][ability] && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            (Racial: {RACE_MODIFIERS_5E[selectedRace][ability] >= 0 ? '+' : ''}{RACE_MODIFIERS_5E[selectedRace][ability]})
                                        </span>
                                    )}
                                    {(selectedAnyIncreases.any1 === ability && (selectedRace === 'Human (Variant)' || selectedRace === 'Half-Elf')) && (
                                        <span className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                            ({RACE_MODIFIERS_5E[selectedRace].any1 > 0 ? '+' : ''}1 Chosen {selectedRace === 'Human (Variant)' ? '1' : ''})
                                        </span>
                                    )}
                                    {(selectedAnyIncreases.any2 === ability && (selectedRace === 'Human (Variant)' || selectedRace === 'Half-Elf') && selectedAnyIncreases.any2 !== selectedAnyIncreases.any1) && (
                                        <span className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                            ({RACE_MODIFIERS_5E[selectedRace].any2 > 0 ? '+' : ''}1 Chosen {selectedRace === 'Human (Variant)' ? '2' : ''})
                                        </span>
                                    )}
                                </>
                            ) : (selectedRace === 'Custom' && customRacialModifiers[ability] !== 0) ? (
                                <span className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    (Custom Racial: {customRacialModifiers[ability] >= 0 ? '+' : ''}{customRacialModifiers[ability]})
                                </span>
                            ) : null}
                            {/* Display Feat/ASI bonuses */}
                            {(startingAsiOption === 'standard' && featAsiChoices.ability1 === ability) && (
                                <span className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    ({featAsiChoices.ability2 ? '+1' : '+2'} from ASI)
                                </span>
                            )}
                            {(startingAsiOption === 'standard' && featAsiChoices.ability2 === ability && featAsiChoices.ability1 !== featAsiChoices.ability2) && (
                                <span className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    (+1 from ASI)
                                </span>
                            )}
                            {(startingAsiOption === 'halfFeat' && featAsiChoices.ability1 === ability) && (
                                <span className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    (+1 from Half-Feat)
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* D&D 5e Specific Rules and Credits */}
            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                <h3 className="text-xl md:text-2xl font-semibold text-red-600 dark:text-red-300 mb-3 cursor-pointer" onClick={() => setIsDescriptionCollapsed(!isDescriptionCollapsed)}>
                    D&D 5e Point Buy Rules Explanation
                    <span className="ml-2 text-sm">[{isDescriptionCollapsed ? 'Show' : 'Hide'}]</span>
                </h3>
                {!isDescriptionCollapsed && (
                    <div className="transition-all duration-300 ease-in-out">
                        <p className="mb-2 text-gray-700 dark:text-gray-300">
                            In D&D 5e, the standard point buy system typically uses a 27-point pool. Each ability score starts at 8, and points are spent to increase them up to a maximum of 15 before racial bonuses. Scores below 8 provide no points back.
                        </p>
                        <p className="mb-2 text-gray-700 dark:text-gray-300">
                            The cost to increase an ability score is cumulative from 8. Here is the standard cost table:
                        </p>
                        <div className="overflow-x-auto mb-4 inline-block w-full">
                            <table className="mx-auto min-w-max divide-y divide-gray-200 dark:divide-gray-700 rounded-lg overflow-hidden">
                                <thead className="bg-gray-100 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cost from 8</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {Object.entries(STANDARD_ABILITY_COSTS_5E).map(([score, cost]) => (
                                        <tr key={score}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{score}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {cost}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                            The typical range for purchasable attributes is {DEFAULT_MIN_PURCHASABLE_5E}-{DEFAULT_MAX_PURCHASABLE_5E} before racial modifiers, but custom limits can be set above.
                        </p>
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border-l-4 border-red-500 rounded-lg text-left">
                            <h3 className="text-xl md:text-2xl font-semibold text-red-700 dark:text-red-200 mb-3">
                                Important: Discuss with Your Game Master!
                            </h3>
                            <p className="text-red-600 dark:text-red-300">
                                Any deviation from the standard point buy rules (such as using custom point costs, a different total point pool, or non-standard minimum/maximum purchasable attributes) should always be discussed and agreed upon with your Game Master or Storyteller. These decisions are crucial for maintaining the balance and integrity of your campaign.
                            </p>
                        </div>
                    </div>
                )}
                <p className="mt-8">Inspired by and a grateful nod to the excellent <a href="https://chicken-dinner.com/5e/5e-point-buy.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">D&D 5e Point Buy Calculator at Chicken Dinner</a>.</p>
                <p className="mt-2">Join our community on Discord: <a href={discordLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Mystery Fantasy Dungeon 9000</a></p>
                {/* Feedback Email Link */}
                <p className="mt-2">
                    Have feedback or suggestions? Email us at: {' '}
                    <a href={`mailto:${feedbackEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline font-bold">
                        {feedbackEmail}
                    </a>
                </p>
                {paypalLink && cashappLink && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900 rounded-lg text-center">
                        <p className="text-sm font-medium text-green-700 dark:text-green-200 mb-2">Enjoying the calculator? Consider supporting its development!</p>
                        <div className="flex justify-center space-x-4">
                            {paypalLink && (
                                <a href={paypalLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-bold">
                                    Support via PayPal
                                </a>
                            )}
                            {cashappLink && (
                                <a href={cashappLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-bold">
                                    Support via Cash App
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Main App Component (Controls Game Selection) ---
const App = () => {
    // State to manage which game calculator is currently active
    const [activeGame, setActiveGame] = useState('3.5e'); // '3.5e' or '5e'

    // Define your Discord invite link here (passed to both calculators)
    const discordInviteLink = "http://discord.gg/kCjuPr6"; // IMPORTANT: Ensure this is your actual invite link!
    const paypalLink = "https://paypal.me/MFD9k"; // Your PayPal.Me link
    const cashappLink = "https://cash.app/$MFD9k"; // Your Cash App link (or Cashtag in a URL format if available)
    const feedbackEmailAddress = "MysteryFantasyDungeon9k@gmail.com"; // UPDATED: Email address

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
            <div className="max-w-4xl mx-auto">
                {/* Main Heading for the entire application - Adjusted size */}
                <h1 className="text-3xl md:text-4xl font-extrabold text-center text-purple-700 dark:text-purple-400 mb-8">
                    RPG Calculator presented by <a href={discordInviteLink} target="_blank" rel="noopener noreferrer" className="text-purple-700 dark:text-purple-400 hover:underline">MFD9K Discord</a>
                </h1>

                {/* Game Selection Dropdown */}
                <div className="flex justify-center mb-6">
                    <label htmlFor="gameSelect" className="block text-lg font-medium text-gray-700 dark:text-gray-300 mr-4 self-center">
                        Select Game:
                    </label>
                    <select
                        id="gameSelect"
                        value={activeGame}
                        onChange={(e) => setActiveGame(e.target.value)}
                        className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-purple-500 focus:border-purple-500 text-lg font-semibold"
                    >
                        <option value="3.5e">D&D 3.5e</option>
                        <option value="5e">D&D 5e</option>
                    </select>
                </div>

                {/* Conditional Game Calculator Rendering */}
                {activeGame === '3.5e' && <Dnd35eCalculator discordLink={discordInviteLink} paypalLink={paypalLink} cashappLink={cashappLink} feedbackEmail={feedbackEmailAddress} />}
                {activeGame === '5e' && <Dnd5eCalculator discordLink={discordInviteLink} paypalLink={paypalLink} cashappLink={cashappLink} feedbackEmail={feedbackEmailAddress} />}
            </div>
        </div>
    );
};

export default App;
