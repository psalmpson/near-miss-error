"""Fixed lists taken from the Near Miss Form (Tables 1 and 2) and the Summary Report.

Keys are stored in the database, labels are shown to people, so a label can be
reworded later without breaking old records.
"""

# (code, name used in the app, label used in the summary report)
ERROR_TYPES = [
    ("D", "Wrong product", "D - Wrong Product"),
    ("E", "Expired product", "E - Expired/Out of Date Product"),
    ("F", "Wrong formulation", "F - Wrong Formulation"),
    ("M", "Missing label", "M - Missing label"),
    ("N", "Wrong patient name", "N - Wrong Patient Name"),
    ("P", "Misread prescription", "P - Misread prescription"),
    ("Q", "Wrong quantity", "Q - Wrong quantity"),
    ("L", "Wrong label", "L - Wrong Label"),
    ("S", "Wrong strength", "S - Wrong Strength"),
]

# Time-of-day bands as written in the Summary Report (the newer revision).
TIMES = [
    ("M", "Morning", "7:00 AM – 11:00 AM"),
    ("L", "Lunch time", "11:01 AM – 1:00 PM"),
    ("A", "Afternoon", "1:01 PM – 3:00 PM"),
    ("E", "Evening", "after 3:01 PM"),
]

# Staff on duty (Staffing Level column of the form)
STAFFING = [
    ("staff_pharmacists", "Pharmacists"),
    ("staff_technicians", "Pharmacy technicians"),
    ("staff_assistants", "Pharmacy assistants"),
    ("staff_interns", "Pharmacy interns"),
]

PERSONNEL = [
    ("pharmacist", "Pharmacist"),
    ("technician", "Pharmacy technician"),
    ("assistant", "Pharmacy assistant"),
    ("intern", "Pharmacy intern"),
    ("student", "Pharmacy student (APPE/IPPE/extern)"),
]

REPORTED_BY = [
    ("pharmacist", "Pharmacist"),
    ("technician", "Pharmacy technician"),
    ("assistant", "Pharmacy assistant"),
    ("intern", "Intern"),
]

CAUSES = [
    ("put_away", "Product put away at wrong location"),
    ("selected", "Product selected incorrectly"),
    ("misread_rx", "Misread prescription (Rx)"),
    ("similar_pack", "Similar packaging"),
    ("out_of_stock", "Product out of stock"),
    ("counting", "Counting error during dispensing"),
    ("ood_shelf", "Out of date products on shelf"),
    ("ood_supplier", "Out of date product sent from supplier"),
    ("inadequate_detail", "Inadequate prescription detail"),
    ("distraction", "Reduced alertness / distraction"),
    ("transfer", "Incorrect transfer of information from the Rx"),
    ("batch_label", "Labeling in batches"),
    ("wrong_label_stuck", "Incorrect label stuck on the wrong product"),
    ("additional", "Additional product / more than one prescription submitted by patient"),
    ("misread_label", "Misread label"),
    ("mixed_bench", "Products mixed on dispensing bench / work station"),
    ("prev_patient", "Previous patient selected from PIMS"),
    ("identical_names", "Identical patient names"),
    ("wrong_mrn", "Wrong patient selected from PIMS / wrong MRN entered"),
    ("no_full_name", "Full name not provided on prescription"),
    ("ambiguous", "Inadequate / ambiguous details"),
    ("handwritten", "Hand-written prescription not clear"),
    ("calc", "Calculation error"),
    ("poor_eval", "Poorly performed Rx evaluation process"),
    ("look_alike", "Look alike"),
    ("sound_alike", "Sound alike"),
    ("rx_reception", "Incomplete Rx reception process"),
    ("other_cause", "Other"),
]

# Causes listed against each error type in Table 2 of the form.
SUGGESTED_CAUSES = {
    "D": ["put_away", "selected", "misread_rx", "similar_pack", "additional", "other_cause"],
    "E": ["ood_shelf", "ood_supplier"],
    "F": ["inadequate_detail", "selected", "misread_rx"],
    "L": ["transfer", "misread_rx", "batch_label", "wrong_label_stuck", "mixed_bench"],
    "M": ["mixed_bench", "misread_rx", "out_of_stock"],
    "N": ["rx_reception", "prev_patient", "identical_names", "wrong_mrn", "misread_rx", "no_full_name"],
    "P": ["ambiguous", "handwritten", "poor_eval"],
    "Q": ["transfer", "misread_rx", "calc", "counting"],
    "S": ["put_away", "selected", "mixed_bench", "misread_rx"],
}

# "Things to consider when reviewing" from Table 2 of the form.
CONSIDER = {
    "D": [
        "Do the packs look similar? Should you separate?",
        "Who puts away the products? Training issues?",
        "More than one Rx being dispensed at a time?",
        "See also 'misread Rx'",
        "Do you dispense from the Rx and not the labels/drug fill slip?",
        "Wrong product ordered or received from supplier?",
        "Has the wrong product been placed in another bag?",
    ],
    "E": [
        "Are you checking the expiry dates of medicines regularly?",
        "Does stock rotation occur?",
        "Are you checking the expiry date when you pick the medicine off the shelf and carry out the final check?",
        "Do the short dated products have a warning/alert sticker on them?",
        "Are there any more out of date products on the shelf?",
        "Do you check expiry dates of products when receiving them from the supplier?",
    ],
    "F": [
        "See also 'misread Rx'",
        "Is everyone familiar with all formulations?",
        "Do the different formulations have similar packaging?",
        "Should they be stored separately?",
    ],
    "L": [
        "Errors likely when label selected from repeats on PIMS",
        "Are products dispensed and labeled one at a time?",
        "Is the dispensing bench/work station clear of clutter and tidy?",
    ],
    "M": [
        "Has the missing product been placed in another bag?",
        "Consider use of dispensing basket",
        "Warning label informing of fridge item",
        "Dispense and label one product at a time",
        "Item missed out when preparing for delivery/collection",
    ],
    "N": [
        "Staff training issues?",
        "Distractions?",
        "Warning for all staff that two patients have the same name",
        "Enough detail on PIMS/patient profile to deal with similar names?",
        "See also 'misread Rx'",
    ],
    "P": [
        "Training issue?",
        "Visual impairment?",
        "Was professional evaluation performed?",
    ],
    "Q": [
        "Have you selected the label from PMR or Rx?",
        "Can someone else check your calculation?",
        "If using a counting machine, is it regularly calibrated and checked for accuracy?",
        "Several pack sizes available",
    ],
    "S": [
        "Do the packs look similar? Should you separate?",
        "Who puts away the goods? Training issue?",
        "Are packs placed on shelf with contents identity visible?",
        "Have you read the Rx correctly? Dispense from the Rx, not the label",
    ],
}

ACTIONS = [
    ("correct_item", "Correct item packed and dispensed"),
    ("correct_label", "Correct label process"),
    ("separated", "Similar packages separated on shelf"),
    ("cancelled", "Cancellation on incorrect item and correct one processed"),
    ("fill_report", "Dispense from Drug Fill Report"),
    ("other_action", "Others"),
]

# Monthly counts typed in on the report page (the "Recommendations" block).
RECS = [
    ("meeting", "Matters discussed in staff monthly meeting"),
    ("discussed", "Corrective actions discussed"),
    ("implemented", "Corrective actions implemented"),
    ("training", "Basic staff training done"),
    ("one_on_one", "One-on-one talk with staff was carried out"),
    ("by_category", "Meeting by staff categories were carried out"),
    ("rec_other", "Others"),
]

DEFAULT_DEPARTMENT = "Out and In Patient Department"
