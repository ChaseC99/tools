<script>
    let feet;
    let inches;

    $: height = feet * 12 + inches;
    let weight;

    $: infoInputted = !!height && !!weight;

    $: bmi = (weight / (height * height)) * 703;

    $: isUnderweight = bmi < 18.5 && infoInputted;
    $: isNormalWeight = 18.5 <= bmi && bmi < 25 && infoInputted;
    $: isOverweight = 25 <= bmi && bmi < 30 && infoInputted;
    $: isObese = bmi >= 30 && infoInputted;

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
                {infoInputted ? bmi.toFixed(2) : "__.__"}
            </div>
        </div>
    </div>

    <div class="bmi-table">
        <!-- bmi categories -->
        <div class="table-row">
            <b>BMI</b>
            <span class:warn-color={isUnderweight}>
                &lt; 18.5
            </span>
            <span class:good-color={isNormalWeight}>
                18.5 - 24.9
            </span>
            <span class:warn-color={isOverweight}>
                25 - 29.9
            </span>
            <span class:danger-color={isObese}>
                &gt; 30
            </span>
        </div>
        <div class="table-row">
            <b>Category</b>
            <span class:warn-color={isUnderweight}>
                Underweight
            </span>
            <span class:good-color={isNormalWeight}>
                Normal weight
            </span>
            <span class:warn-color={isOverweight}>
                Overweight
            </span>
            <span class:danger-color={isObese}>
                Obesity
            </span>
        </div>
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

    .warn-color {
        color: #f68e48;
    }

    .good-color {
        color: #0c0;
    }

    .danger-color {
        color: #d00;
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

    .bmi-table {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background-color: #eee;
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .table-row {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        gap: 32px;
    }

    .table-row span, .table-row b {
        flex: 1;

    }

    /* Handle mobile screens */
    @media (max-width: 600px) {
        .row {
            flex-direction: column;
            gap: 1rem;
            align-items: start;
        }

        .table-row {
            flex-direction: column;
            gap: 0.5rem;
        }

        .bmi-table {
            flex-direction: row;
            gap: 48px;
        }
    }
</style>
