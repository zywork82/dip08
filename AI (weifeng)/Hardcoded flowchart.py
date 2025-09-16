import json

def create_json(filename="flowchart.json"):
    """
    Creates a JSON object for a scenario facing an executive committee.
    """
    data = [
    # Scene 1: The initial encounter
    {
        "id": "optionA",
        "text": "The air in the boardroom is thick with anticipation. You stand before a group of six stern-faced executive committee members, their gazes fixed on you. The presentation you just delivered is on the screen behind you, and a hushed silence follows your final slide. The time for questions has arrived.",
        "scene": "A modern corporate boardroom with a long glass table, leather chairs, and a large screen displaying a business presentation. The room is filled with six executives, dressed in formal business attire, looking serious and attentive.",
        "narrative": "One of the committee members, a woman with a sharp, discerning look, leans forward. 'Your proposal sounds ambitious,' she begins, 'but where's the return on investment? Our shareholders demand numbers, not just vision.' You consider your response, knowing that every word counts.",
        "B64 image": ""
    },
    # Scene 2: The direct response
    {
        "id": "optionB",
        "text": "You take a deep breath, the silence stretching. You focus on the woman's piercing gaze and the expectant faces of the others. This is the moment to prove the value of your vision with concrete data.",
        "scene": "The tension is palpable. The committee members lean forward slightly, waiting for your answer. The large display behind you now shows a single, simple chart highlighting projected revenue streams and cost savings. Your stance is confident, your expression determined.",
        "narrative": "“The return is twofold,” you say, your voice steady. “First, the numbers. Our projections show a conservative 15% ROI within the first 18 months, driven by automated efficiency and market expansion. Second, a return on our brand. This isn't just a product; it's a statement. It positions us as innovators, which, in a competitive landscape, is an invaluable asset that will continue to generate returns long after the initial investment.”",
        "B64 image": ""
    }
]

    try:
        with open(filename, 'w') as json_file:
            json.dump(data, json_file, indent=4)
        print(f"JSON file '{filename}' created successfully.")
    except Exception as e:
        print(f"An error occurred: {e}")

# Call the function to create the file
create_json()