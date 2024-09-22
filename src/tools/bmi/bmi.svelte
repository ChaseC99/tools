<script>
    let feet;
    let inches;

    $: height = feet * 12 + inches;
    let weight;

    $: bmi = (weight / (height * height)) * 703;

    function selectText(event) {
        event.target.select();
    }
</script>

<main>
    <div class="row">
        <div class="input-section">
            Height
            <div id="height-inputs">
                <input
                    type="number"
                    id="feet"
                    placeholder="ft"
                    min="0"
                    bind:value={feet}
                    on:focus={selectText}
                />

                <input
                    type="number"
                    id="inches"
                    placeholder="in"
                    min="0"
                    max="11"
                    bind:value={inches}
                    on:focus={selectText}
                />
            </div>
        </div>

        <div class="input-section">
            Weight
            <input
                type="number"
                id="weight"
                placeholder="lbs"
                min="0"
                bind:value={weight}
                on:focus={selectText}
            />
        </div>

        <div class="input-section">
            BMI
            <div id="bmi">
                {height & weight ? bmi.toFixed(2) : "__.__"}
            </div>
        </div>
    </div>

    <div class="row">
        <!-- bmi categories -->
        <table>
            <tbody>
                <tr>
                    <th>BMI</th>
                    <td>&lt; 18.5</td>
                    <td>18.5 - 24.9</td>
                    <td>25 - 29.9</td>
                    <td>&gt; 30</td>
                </tr>
                <tr>
                    <th>Category</th>
                    <td>Underweight</td>
                    <td>Normal weight</td>
                    <td>Overweight</td>
                    <td>Obesity</td>
                </tr>
            </tbody>
        </table>
    </div>
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 5rem;

        margin: 2rem 0;
    }

    #bmi {
        margin-bottom: 1rem;
        padding-left: 0.5rem;
        width: 3.5rem;
        height: 3rem;
        font-size: larger;
        border-radius: 0;
        border: 1px solid #ccc;

        display: flex;
        align-items: center;
    }

    input {
        margin-bottom: 1rem;
        padding-left: 0.5rem;
        width: 3rem;
        height: 3rem;
        font-size: larger;
        border-radius: 0;
        border: 1px solid #ccc;
    }

    input:focus {
        outline: none;
    }

    #height-inputs {
        display: flex;
        justify-content: space-between;
    }

    .input-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    /* Hide number input up/down arrows */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        /* display: none; <- Crashes Chrome on hover */
        -webkit-appearance: none;
        margin: 0; /* <-- Apparently some margin are still there even though it's hidden */
    }

    input[type="number"] {
        -moz-appearance: textfield; /* Firefox */
        appearance: none;
    }

    table {
        border-collapse: collapse;
    }

    th, td {
        padding: 0.5rem 1rem;
        border: 1px solid #ccc;
    }
</style>
