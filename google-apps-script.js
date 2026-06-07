// Google Apps Script Web App Gateway
// Copy and paste this entire code into Extensions > Apps Script (Code.gs) in your Google Sheet

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    // 1. Upload File to Google Drive
    if (action === 'upload') {
      var folderId = "1PxTneiPK85c6LnXSr7KJO13tGV1kMUEr";
      var folder = DriveApp.getFolderById(folderId);
      
      var fileBytes = Utilities.base64Decode(payload.base64Data);
      var blob = Utilities.newBlob(fileBytes, payload.mimeType, payload.filename);
      
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileId: file.getId(),
        fileUrl: file.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Log Verification Record to Google Sheet
    if (action === 'log_verification') {
      var sheet = SpreadsheetApp.openById("1VlsoMoLqyNm5INvhO0BN5wl4VjQyewTmFbLVOSr8ZQM").getActiveSheet();
      
      // Auto-create headers if the sheet is empty
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "Timestamp", 
          "Citizen Name", 
          "Date of Birth", 
          "Aadhaar Number", 
          "Mobile Number", 
          "PAN Card", 
          "Physical GPS Address", 
          "Aadhaar Document URL", 
          "PAN Document URL",
          "Transaction ID"
        ]);
      }
      
      sheet.appendRow([
        new Date(),
        payload.name,
        payload.dob,
        payload.aadhaar,
        payload.phone,
        payload.pan,
        payload.gpsAddress,
        payload.aadhaarDocUrl,
        payload.panDocUrl,
        payload.txId
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Record logged to Google Sheet successfully."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Invalid action"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle CORS preflight options request
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// IMPORTANT: Run this function once in the Apps Script editor to authorize Drive and Sheets access!
function runOnceToAuthorize() {
  Logger.log("Authorizing DriveApp...");
  var folder = DriveApp.getFolderById("1PxTneiPK85c6LnXSr7KJO13tGV1kMUEr");
  Logger.log("Folder access: " + folder.getName());
  
  Logger.log("Authorizing SpreadsheetApp...");
  var sheet = SpreadsheetApp.openById("1VlsoMoLqyNm5INvhO0BN5wl4VjQyewTmFbLVOSr8ZQM");
  Logger.log("Spreadsheet access: " + sheet.getName());
}
