import React, { useState } from "react";
import "./App.css";

const itemData = {
  mini: {
    weightOfOneGross: 68,
    revitInGrams: 10,
    itemWeightInKg: 1,
  },
  med: {
    weightOfOneGross: 100,
    revitInGrams: 10,
    itemWeightInKg: 1,
  },
};

function App() {
  const [selectedItemName, setSelectedItemName] = useState("");
  const [weightOfOneGross, setWeightOfOneGross] = useState(0);
  const [revitInGrams, setRevitInGrams] = useState(0);
  const [itemWeightInKg, setItemWeightInKg] = useState(0);

  const handleItemNameChange = (event) => {
    const selectedName = event.target.value;
    setSelectedItemName(selectedName);

    if (selectedName in itemData) {
      const { weightOfOneGross, revitInGrams, itemWeightInKg } =
        itemData[selectedName];
      setWeightOfOneGross(weightOfOneGross);
      setRevitInGrams(revitInGrams);
      setItemWeightInKg(itemWeightInKg);
    } else {
      setWeightOfOneGross(0);
      setRevitInGrams(0);
      setItemWeightInKg(0);
    }
  };

  const calculateResults = () => {
    const weightPerGross = weightOfOneGross / 1000;
    const noOfGross = itemWeightInKg / weightPerGross;
    const revitReqInKg = (revitInGrams * noOfGross) / 1000;
    const totalWeight = revitReqInKg + itemWeightInKg;

    return { revitReqInKg, totalWeight, noOfGross };
  };

  const { revitReqInKg, totalWeight, noOfGross } = calculateResults();

  return (
    <div className="App">
      <h1>Item Calculator</h1>
      <div className="form-group">
        <label htmlFor="itemName">Item Name:</label>
        <select
          id="itemName"
          value={selectedItemName}
          onChange={handleItemNameChange}
        >
          <option value="">Select an item</option>
          {Object.keys(itemData).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="weightOfOneGross">Weight of One Gross (g):</label>
        <input
          id="weightOfOneGross"
          type="text"
          value={weightOfOneGross}
          readOnly
        />
      </div>
      <div className="form-group">
        <label htmlFor="revitInGrams">Weight of Revit in Grams:</label>
        <input id="revitInGrams" type="text" value={revitInGrams} readOnly />
      </div>
      <div className="form-group">
        <label htmlFor="itemWeightInKg">Enter Item Weight in Kg:</label>
        <input
          id="itemWeightInKg"
          type="number"
          value={itemWeightInKg}
          onChange={(e) => setItemWeightInKg(parseFloat(e.target.value))}
        />
      </div>
      <div className="results">
        <h2>Results</h2>
        <p>Revit Req in Kg: {revitReqInKg}</p>
        <p>Total Weight (Kg): {totalWeight}</p>
        <p>Number of Gross: {noOfGross}</p>
      </div>
    </div>
  );
}

export default App;
