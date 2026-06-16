import os
from openai import OpenAI

# Initialize the Qwen Client using your hackathon voucher API key
client = OpenAI(
    api_key=os.getenv("QWEN_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

# Simulated Campus State (No database required for the prototype)
CAMPUS_DATA = {
    "student_schedule": "10:00 AM - Gross Anatomy Lab (Building A)",
    "current_time": "09:48 AM",
    "current_location": "Main Campus Gate",
    "active_hazards": ["The central walkway between Main Gate and Building A is severely flooded after the morning rain."],
    "syllabus": "Today's Gross Anatomy Lab covers the exhaustive structural pathways of the Perineal Muscles and deep pelvic fascia."
}

def navigation_agent(student_query, campus_context):
    """Specialized Agent for handling spatial reasoning and routing."""
    system_prompt = (
        "You are the Campus Wayfinder Agent. Your sole job is to navigate students through physical campus hurdles "
        "(flooding, power outages, crowd bottlenecks). You have access to real-time hazards. Always provide alternative paths "
        "and explain why they are safer or faster. Keep your tone direct and helpful."
    )
    
    user_content = f"Student Query: {student_query}\nContext: {campus_context}"
    
    response = client.chat.completions.create(
        model="qwen-max", # Using the flagship model for complex reasoning
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    )
    return response.choices[0].message.content

def ta_agent(student_query, campus_context):
    """Specialized Agent for handling academic administrative inquiries."""
    system_prompt = (
        "You are the Academic TA Agent. Your job is to field student questions about class schedules, syllabus details, "
        "and lab requirements. Keep students on track academically."
    )
    
    user_content = f"Student Query: {student_query}\nContext: {campus_context}"
    
    response = client.chat.completions.create(
        model="qwen-plus", # Using a faster, cost-effective model for text tasks
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    )
    return response.choices[0].message.content

# --- Run the Multi-Agent Simulation ---
if __name__ == "__main__":
    print("=== OMNI-CAMPUS BACKEND INITIALIZED ===\n")
    
    # Simulation: Student opens the app and panics because it's raining and they have a lab
    student_input = "It's pouring, I'm at the gate, and I don't know how to get to my anatomy lab or what we are even covering today!"
    print(f"Student Input: '{student_input}'\n")
    
    print("--- Routing to Navigation Agent... ---")
    nav_response = navigation_agent(student_input, CAMPUS_DATA)
    print(f"Wayfinder AI:\n{nav_response}\n")
    
    print("--- Routing to TA Agent... ---")
    academic_response = ta_agent(student_input, CAMPUS_DATA)
    print(f"TA AI:\n{academic_response}\n")
    
    print("=======================================")