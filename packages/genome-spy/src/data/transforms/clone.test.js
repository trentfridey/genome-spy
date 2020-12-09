import { processData } from "../flowTestUtils";
import CloneTransform from "./clone";

test("CloneTransform clones the data objects", () => {
    const data = [{ x: 1 }];
    const clonedData = processData(new CloneTransform(), data);

    expect(clonedData).toEqual(data);
    expect(clonedData[0]).not.toBe(data[0]);
});
