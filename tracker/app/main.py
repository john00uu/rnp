
# # # # Database connection parameters

# # # DB_HOST = os.environ.get("DB_HOST", "10.13.44.80")
# # # DB_PORT = os.environ.get("DB_PORT", "5432")
# # # DB_NAME = os.environ.get("DB_NAME", "RNP")  # Updated o RNP
# # # DB_USER = os.environ.get("DB_USER", "postgres")
# # # DB_PASS = os.environ.get("DB_PASS", "P@ssw0rd")


# from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Request
# from fastapi.responses import JSONResponse, FileResponse
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.staticfiles import StaticFiles
# from fastapi.responses import RedirectResponse
# from fastapi.security import HTTPBasic, HTTPBasicCredentials, OAuth2PasswordBearer, OAuth2PasswordRequestForm
# from typing import List, Dict, Any, Optional
# import psycopg2
# import psycopg2.extras
# import os
# import secrets
# import pandas as pd
# from io import BytesIO
# import base64, datetime
# # from datetime import datetime, timedelta
# from jose import JWTError, jwt

# # Initialize FastAPI app
# app = FastAPI(title="azerconnect Data Platform API")
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
# # Add CORS middleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
# # Mount static files
# app.mount("/static", StaticFiles(directory="static"), name="static")
# # Database connection parameters
# DB_HOST = os.getenv("DB_HOST", "10.13.44.80")
# DB_PORT = os.getenv("DB_PORT", "5432")
# DB_NAME = os.getenv("DB_NAME", "RNP")  # Updated o RNP
# DB_USER = os.getenv("DB_USER", "postgres")
# DB_PASS = os.getenv("DB_PASS", "P@ssw0rd")
# # Security
# security = HTTPBasic()
# # In a real application, these would be stored securely, not hardcoded
# USERS = {
#     "admin": {
#         "password": "admin123",
#         "preferences": {
#             "columns": ["SITE_ID", "Site Name", "DISTRICT_COMMUNITY", "City/Road", 
#                         "Economical Region", "Lat", "Long", "Planning Status"]
#         }
#     }
# }
# # Session tokens
# active_sessions = {}
# SECRET_KEY = "your_secret_key"
# ALGORITHM = "HS256"
# # Helper function to connect to the database
# def get_db_connection():
#     try:
#         conn = psycopg2.connect(
#             host=DB_HOST,
#             port=DB_PORT,
#             dbname=DB_NAME,
#             user=DB_USER,
#             password=DB_PASS
#         )
#         return conn
#     except Exception as e:
#         print(f"Database connection error: {e}")
#         raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")
# # Authentication dependency
# def get_current_user(token: str = None):
#     if not token or token not in active_sessions:
#         raise HTTPException(
#             status_code=401,
#             detail="Invalid authentication credentials",
#             headers={"WWW-Authenticate": "Bearer"},
#         )
#     return active_sessions[token]
# # Login endpoint
# @app.post("/login")
# async def login(credentials:OAuth2PasswordRequestForm = Depends()):
#     username = credentials.username
#     password = credentials.password
#     if username in USERS and USERS[username]["password"] == password:
#         token = secrets.token_hex(16)
        
#         expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
#         token_data = {"sub": username, "exp": expiration}
#         token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

#         return {"access_token": token, "token_type": "bearer"}        
#     raise HTTPException(
#         status_code=401,
#         detail="Invalid username or password",
#         headers={"WWW-Authenticate": "Basic"},
#     )
# @app.get("/protected")
# async def protected(token: str = Depends(oauth2_scheme)):
#     try:
#         payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
#         username = payload.get("sub")
#         return {"message": f"Welcome {username}!"}
#     except JWTError:
#         raise HTTPException(status_code=401, detail="Invalid token")
# # Get all column names
# @app.get("/columns")
# async def get_columns(token: str = None):
#     get_current_user(token)
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor()
#         # Get column names from the table
#         cursor.execute("""
#         SELECT column_name 
#         FROM information_schema.columns 
#         WHERE table_name = 'tracker'
#         ORDER BY ordinal_position;
#         """)
#         columns = [row[0] for row in cursor.fetchall()]
#         print(columns)
#         print('columns')
#         return {"columns": columns}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cursor.close()
#         conn.close()
# # Get paginated data
# @app.get("/data")
# async def get_data(offset: int = 0, limit: int = 20, token: str = None):
#     get_current_user(token)
    
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
#         # Get total count
#         cursor.execute("SELECT COUNT(*) FROM tracker")
#         total_count = cursor.fetchone()["count"]
        
#         # Get paginated data
#         cursor.execute("SELECT * FROM tracker OFFSET %s LIMIT %s", 
#                       (offset, limit))
#         results = cursor.fetchall()
#         print(results)
#         return {
#             "data": results,
#             "total": total_count,
#             "offset": offset,
#             "limit": limit
#         }
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cursor.close()
#         conn.close()
# # Get all data (for expanding row details)
# @app.get("/data/all")
# async def get_all_data(token: str = None):
#     get_current_user(token)
    
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
#         cursor.execute("SELECT * FROM tracker")
#         results = cursor.fetchall()
        
#         return {"data": results}
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cursor.close()
#         conn.close()
# # Edit data
# @app.post("/data/edit")
# async def edit_data(request: Request, token: str = None):
#     get_current_user(token)
#     try:
#         # Get request body
#         body = await request.json()
#         updates = body.get("updates", [])
#         if not updates:
#             raise HTTPException(status_code=400, detail="No updates provided")
#         conn = get_db_connection()
#         cursor = conn.cursor()
#         for update in updates:
#             row_id = update.get("SITE_ID")
#             changes = update.get("changes", {})
#             if not row_id or not changes:
#                 continue
#             # Build SET clause for SQL update
#             set_clauses = []
#             values = []
#             for column, value in changes.items():
#                 set_clauses.append(f'"{column}" = %s')
#                 values.append(value)
#             # Add row_id to values
#             values.append(row_id)
#             # Execute update
#             sql = f"UPDATE tracker SET {', '.join(set_clauses)} WHERE SITE_ID = %s"
#             cursor.execute(sql, values)
        
#         conn.commit()
#         return {"success": True, "message": "Data updated successfully"}
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cursor.close()
#         conn.close()
# # Import data from Excel
# @app.post("/data/import")
# async def import_data(file: UploadFile = File(...), token: str = None):
#     get_current_user(token)
    
#     if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
#         raise HTTPException(status_code=400, detail="File must be Excel or CSV")
    
#     try:
#         contents = await file.read()
        
#         # Read Excel/CSV file
#         if file.filename.endswith('.csv'):
#             df = pd.read_csv(BytesIO(contents))
#         else:
#             df = pd.read_excel(BytesIO(contents))
        
#         # Convert DataFrame to list of dictionaries
#         records = df.to_dict('records')
        
#         conn = get_db_connection()
#         cursor = conn.cursor()
        
#         # Insert records
#         for record in records:
#             # Clean NaN values
#             clean_record = {k: (v if pd.notna(v) else None) for k, v in record.items()}
            
#             # Build the SQL dynamically based on the record keys
#             columns = []
#             placeholders = []
#             values = []
            
#             for key, value in clean_record.items():
#                 if value is not None:  # Only include non-None values
#                     columns.append(f'"{key}"')
#                     placeholders.append('%s')
#                     values.append(value)
            
#             if columns:  # Only proceed if we have columns to insert
#                 sql = f"INSERT INTO tracker ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
#                 cursor.execute(sql, values)
        
#         conn.commit()
#         return {"success": True, "message": f"Imported {len(records)} records successfully"}
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cursor.close()
#         conn.close()
# # Export data to Excel
# @app.get("/data/export")
# async def export_data(token: str = None):
#     get_current_user(token)
    
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
#         cursor.execute("SELECT * FROM tracker")
#         results = cursor.fetchall()
        
#         # Create DataFrame
#         df = pd.DataFrame(results)
    
#         # Create Excel file in memory
#         output = BytesIO()
#         with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
#             df.to_excel(writer, sheet_name='Data', index=False)
        
#         output.seek(0)
        
#         # Generate a unique filename
#         filename = f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
#         # Save the file temporarily
#         with open(filename, "wb") as f:
#             f.write(output.getvalue())
        
#         # Return the file
#         return FileResponse(
#             path=filename,
#             filename=filename,
#             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
#         )
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cursor.close()
#         conn.close()
# # Get user preferences
# @app.get("/user/preferences")
# async def get_user_preferences(token: str = None):
#     username = get_current_user(token)
    
#     if username in USERS and "preferences" in USERS[username]:
#         return USERS[username]["preferences"]
    
#     return {"columns": ["SITE_ID", "Site Name", "DISTRICT_COMMUNITY", "City/Road", 
#                         "Economical Region", "Lat", "Long", "Planning Status"]}
# # Save user preferences
# @app.post("/user/preferences")
# async def save_user_preferences(request: Request, token: str = None):
#     username = get_current_user(token)
    
#     try:
#         body = await request.json()
#         preferences = body.get("preferences", {})
        
#         if username in USERS:
#             USERS[username]["preferences"] = preferences
#             return {"success": True, "message": "Preferences saved successfully"}
        
#         raise HTTPException(status_code=404, detail="User not found")
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
# # Search data
# @app.post("/data/search")
# async def search_data(request: Request, token: str = None):
#     get_current_user(token)
#     try:
#         body = await request.json()
#         search_term = body.get("term", "")
#         columns = body.get("columns", [])
#         if not search_term:
#             raise HTTPException(status_code=400, detail="Search term is required")
#         conn = get_db_connection()
#         cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
#         # Build query based on columns
#         if columns:
#             query_conditions = []
#             for column in columns:
#                 query_conditions.append(f'"{column}"::text ILIKE \'%{search_term}%\'')
            
#             query = f"SELECT * FROM tracker WHERE {' OR '.join(query_conditions)} ORDER BY SITE_ID"
#         else:
#             # Search in all columns (except id)
#             cursor.execute("""
#             SELECT column_name 
#             FROM information_schema.columns 
#             WHERE table_name = 'tracker'
#             """)
#             all_columns = [row[0] for row in cursor.fetchall()]
            
#             query_conditions = []
#             for column in all_columns:
#                 query_conditions.append(f'"{column}"::text ILIKE \'%{search_term}%\'')
            
#             query = f"SELECT * FROM tracker WHERE {' OR '.join(query_conditions)} ORDER BY SITE_ID"
        
#         cursor.execute(query)
#         results = cursor.fetchall()
        
#         return {"data": results, "count": len(results)}
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cursor.close()
#         conn.close()

# # Serve the main HTML page
# @app.get("/")
# async def get_index():
#     return  RedirectResponse(url="/login-page")

# # Serve the login page
# @app.get("/login-page")
# async def get_login_page():
#     return FileResponse("static/login.html")

# # Main entry point
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)


from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Dict, Any
import psycopg2
import psycopg2.extras
import os
import secrets
import pandas as pd
from io import BytesIO
import base64
import datetime
from jose import JWTError, jwt

# Initialize FastAPI app
app = FastAPI(title="Azerconnect Data Platform API")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Database connection parameters
DB_HOST = "10.13.44.80"
DB_PORT = "5432"
DB_NAME = "RNP"
DB_USER = "postgres"
DB_PASS = "P@ssw0rd"

# Security
SECRET_KEY = "ADFGGWSGEGGBWBBRRGSERBBBSTFG234R34G"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# User storage (Replace with DB in production)
USERS = {
    "admin": {
        "password": "admin123",
        "preferences": {
            "columns": ["SITE_ID", "Site Name", "DISTRICT_COMMUNITY", "City/Road", "Economical Region", "Lat", "Long", "Planning Status"]
        }
    }
}

# Database connection function
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

# Generate JWT token
def create_access_token(data: dict, expires_delta: datetime.timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Get current user from JWT token
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None or username not in USERS:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Login endpoint
@app.post("/login")
async def login(credentials: OAuth2PasswordRequestForm = Depends()):
    username = credentials.username
    password = credentials.password

    if username in USERS and USERS[username]["password"] == password:
        token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(data={"sub": username}, expires_delta=token_expires)
        return {"access_token": access_token, "token_type": "bearer"}
    
    raise HTTPException(status_code=401, detail="Invalid username or password")

# Get all column names
@app.get("/columns")
async def get_columns(user: str = Depends(get_current_user)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'tracker' ORDER BY ordinal_position;")
        columns = [row[0] for row in cursor.fetchall()]
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# Get paginated data with infinite scrolling
@app.get("/data")
async def get_data(offset: int = 0, limit: int = 20, user: str = Depends(get_current_user)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT COUNT(*) FROM tracker")
        total_count = cursor.fetchone()["count"]
        cursor.execute("SELECT * FROM tracker OFFSET %s LIMIT %s", (offset, limit))
        results = cursor.fetchall()
        return {"data": results, "total": total_count, "offset": offset, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# Get all data
@app.get("/data/all")
async def get_all_data(user: str = Depends(get_current_user)):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT * FROM tracker")
        results = cursor.fetchall()
        return {"data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

# Serve the main HTML page
@app.get("/")
async def get_index():
    return RedirectResponse(url="/login-page")

# Serve the login page
@app.get("/login-page")
async def get_login_page():
    return FileResponse("static/login.html")

# Run FastAPI app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
